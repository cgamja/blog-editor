import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { authenticate, sessionAccountId } from "../../session";
import type { SessionConfig } from "../../session";
import { DRAFTS_SCOPE } from "../constants";
import { CODE_TTL_SECONDS, MAX_FORM_BYTES, NO_STORE_HEADERS } from "./constants";
import { formStrings } from "./form";
import {
  FORBIDDEN_ORIGIN_PAGE_MESSAGE,
  INVALID_CLIENT_PAGE_MESSAGE,
  LOGIN_FAILED_PAGE_MESSAGE,
  PKCE_REQUIRED_DESCRIPTION,
} from "./messages";
import { consentPage, errorPage } from "./pages";
import { isS256Challenge } from "./pkce";
import { isLoopbackRedirect, matchesRegisteredRedirect, sourceNameOf } from "./redirect-uris";
import type { OAuthClient, OAuthStore } from "./store";
import { hashOpaqueToken, mcpResourceOf, newOpaqueToken, sameResource } from "./tokens";
import type { OAuthOptions } from "./types";

/** 동의 화면은 다른 사이트의 iframe에 못 들어간다(클릭재킹). 제출 뒤 claude.ai로 리다이렉트하므로 form-action은 걸지 않는다 */
const PAGE_HEADERS = {
  ...NO_STORE_HEADERS,
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
};

type Params = Readonly<Record<string, string | undefined>>;

interface AuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  state: string | undefined;
  codeChallenge: string;
  resource: string;
  scope: string;
}

type AuthorizeValidation =
  | { kind: "invalid_client" }
  | {
      kind: "redirect_error";
      redirectUri: string;
      state: string | undefined;
      error: string;
      description?: string;
    }
  | { kind: "ok"; request: AuthorizeRequest };

/**
 * client_id · redirect_uri가 틀리면 어디로도 리다이렉트하지 않는다(열린 리다이렉트 방지). 그 둘이 맞은 뒤의
 * 오류는 RFC 6749 4.1.2.1대로 redirect_uri에 `error`로 돌려준다.
 */
async function validateAuthorize(
  params: Params,
  store: OAuthStore,
  resource: string,
): Promise<AuthorizeValidation> {
  const { client_id: clientId, redirect_uri: redirectUri, state } = params;
  const client = clientId === undefined ? null : await store.findClient(clientId);
  if (client === null || redirectUri === undefined) return { kind: "invalid_client" };
  if (!matchesRegisteredRedirect(redirectUri, client.redirectUris)) {
    return { kind: "invalid_client" };
  }

  const fail = (error: string, description?: string): AuthorizeValidation => ({
    kind: "redirect_error",
    redirectUri,
    state,
    error,
    ...(description === undefined ? {} : { description }),
  });
  if (params.response_type !== "code") return fail("unsupported_response_type");
  const challenge = params.code_challenge;
  const hasS256 =
    params.code_challenge_method === "S256" &&
    challenge !== undefined &&
    isS256Challenge(challenge);
  if (!hasS256) return fail("invalid_request", PKCE_REQUIRED_DESCRIPTION);
  if (params.resource !== undefined && !sameResource(params.resource, resource)) {
    return fail("invalid_target");
  }
  const scopes = (params.scope ?? DRAFTS_SCOPE).split(" ").filter((scope) => scope !== "");
  if (!scopes.every((scope) => scope === DRAFTS_SCOPE)) return fail("invalid_scope");
  return {
    kind: "ok",
    request: {
      client,
      redirectUri,
      state,
      codeChallenge: challenge,
      resource,
      scope: DRAFTS_SCOPE,
    },
  };
}

/** 동의 폼이 POST로 되돌려 보낼 값 — 서버에 저장하지 않고 POST에서 다시 검증한다(design 3) */
function requestFields(request: AuthorizeRequest): Record<string, string> {
  return {
    client_id: request.client.clientId,
    redirect_uri: request.redirectUri,
    response_type: "code",
    ...(request.state === undefined ? {} : { state: request.state }),
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
    resource: request.resource,
    scope: request.scope,
  };
}

/** `/authorize` — 사람이 로그인하고 허용해야 코드가 나온다(mcp-oauth-grant) */
export function registerAuthorizeRoutes(
  app: Hono,
  { issuer, store, session }: OAuthOptions & { session: SessionConfig },
): void {
  const resource = mcpResourceOf(issuer);
  const issuerOrigin = new URL(issuer).origin;

  const redirectWith = (c: Context, redirectUri: string, params: Params) => {
    const url = new URL(redirectUri);
    for (const [name, value] of Object.entries({ ...params, iss: issuer })) {
      if (value !== undefined) url.searchParams.set(name, value);
    }
    return c.redirect(url.toString(), 302);
  };
  const page = (c: Context, html: string, status: 200 | 400 | 401 | 403) =>
    c.html(html, status, PAGE_HEADERS);
  const consent = (request: AuthorizeRequest, needsLogin: boolean, errorMessage?: string) =>
    consentPage({
      clientName: request.client.clientName,
      redirectUri: request.redirectUri,
      loopback: isLoopbackRedirect(request.redirectUri),
      request: requestFields(request),
      needsLogin,
      ...(errorMessage === undefined ? {} : { errorMessage }),
    });
  const refuse = (c: Context, validation: Exclude<AuthorizeValidation, { kind: "ok" }>) => {
    if (validation.kind === "invalid_client") {
      return page(c, errorPage(INVALID_CLIENT_PAGE_MESSAGE), 400);
    }
    const { redirectUri, state, error, description } = validation;
    return redirectWith(c, redirectUri, { error, error_description: description, state });
  };

  app.get("/authorize", async (c) => {
    const validation = await validateAuthorize(c.req.query(), store, resource);
    if (validation.kind !== "ok") return refuse(c, validation);
    const needsLogin = (await sessionAccountId(c, session)) === null;
    return page(c, consent(validation.request, needsLogin), 200);
  });

  app.post("/authorize", bodyLimit({ maxSize: MAX_FORM_BYTES }), async (c) => {
    // 세션만으로 허용하는 길은 SameSite=Strict가 받치고, Origin이 보이면 한 번 더 확인한다(design 3)
    const origin = c.req.header("Origin");
    if (origin !== undefined && origin !== issuerOrigin) {
      return page(c, errorPage(FORBIDDEN_ORIGIN_PAGE_MESSAGE), 403);
    }
    const form = await formStrings(c);
    const validation = await validateAuthorize(form, store, resource);
    if (validation.kind !== "ok") return refuse(c, validation);
    const { request } = validation;
    if (form.decision !== "allow") {
      return redirectWith(c, request.redirectUri, { error: "access_denied", state: request.state });
    }

    const fromSession = await sessionAccountId(c, session);
    const { username, password } = form;
    const account =
      fromSession === null && username !== undefined && password !== undefined
        ? await authenticate(session, username, password)
        : null;
    const accountId = fromSession ?? account?.id ?? null;
    if (accountId === null) {
      return page(c, consent(request, true, LOGIN_FAILED_PAGE_MESSAGE), 401);
    }

    const code = newOpaqueToken();
    await store.saveCode(hashOpaqueToken(code), {
      clientId: request.client.clientId,
      accountId,
      resource: request.resource,
      scope: request.scope,
      sourceName: sourceNameOf(request.redirectUri),
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      expiresAt: session.nowSeconds() + CODE_TTL_SECONDS,
    });
    return redirectWith(c, request.redirectUri, { code, state: request.state });
  });
}
