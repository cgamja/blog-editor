import { randomBytes, randomUUID } from "node:crypto";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { authenticate, sessionAccountId } from "../../session";
import type { SessionConfig } from "../../session";
// 코드 · 토큰도 무작위 고엔트로피 문자열이라 연결용 토큰과 같은 이유로 SHA-256만 남긴다(adr-016)
import { hashConnectionToken as hashOpaqueToken } from "../connection-tokens";
import {
  FORBIDDEN_ORIGIN_PAGE_MESSAGE,
  INVALID_CLIENT_METADATA_DESCRIPTION,
  INVALID_CLIENT_PAGE_MESSAGE,
  INVALID_GRANT_DESCRIPTION,
  INVALID_REDIRECT_URI_DESCRIPTION,
  LOGIN_FAILED_PAGE_MESSAGE,
  PKCE_REQUIRED_DESCRIPTION,
} from "./messages";
import { consentPage, errorPage } from "./pages";
import { isS256Challenge, verifyS256 } from "./pkce";
import {
  isAllowedRedirectUri,
  isLoopbackRedirect,
  matchesRegisteredRedirect,
  sourceNameOf,
} from "./redirect-uris";
import type { OAuthClient, OAuthGrant, OAuthStore } from "./store";

export interface OAuthOptions {
  /** 발급자 = 이 서비스의 공개 origin(끝 `/` 없음). MCP URL은 `<issuer>/mcp` */
  issuer: string;
  store: OAuthStore;
}

/** 토큰 하나가 여는 권한 — 초안 읽기 · 쓰기뿐(adr-007). 발행 범위는 없다 */
export const DRAFTS_SCOPE = "drafts";
const CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const TOKEN_BYTES = 32;
/** 등록 · 토큰 요청은 작은 JSON · 폼이다 */
const MAX_FORM_BYTES = 16 * 1024;
const MAX_CLIENT_NAME_LENGTH = 100;
const DEFAULT_CLIENT_NAME = "AI 앱";
const GRANT_TYPES = ["authorization_code", "refresh_token"] as const;
const RESPONSE_TYPES = ["code"] as const;
const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };
/** 동의 화면은 다른 사이트의 iframe에 못 들어간다(클릭재킹). 제출 뒤 claude.ai로 리다이렉트하므로 form-action은 걸지 않는다 */
const PAGE_HEADERS = {
  ...NO_STORE,
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
};

export function mcpResourceOf(issuer: string): string {
  return `${issuer}/mcp`;
}

export function protectedResourceMetadataUrl(issuer: string): string {
  return `${issuer}/.well-known/oauth-protected-resource/mcp`;
}

function newOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** RFC 8707 — 끝 `/` 하나는 같은 자원으로 본다 */
function sameResource(requested: string, resource: string): boolean {
  return requested.replace(/\/$/, "") === resource;
}

/** `/mcp`가 부른다 — 유효하면 초안 출처 이름, 아니면 null */
export async function verifyAccessToken(
  { issuer, store }: OAuthOptions,
  token: string,
  nowSeconds: number,
): Promise<string | null> {
  const found = await store.findAccessToken(hashOpaqueToken(token));
  if (found === null || found.expiresAt <= nowSeconds) return null;
  if (found.resource !== mcpResourceOf(issuer)) return null;
  return found.sourceName;
}

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
  if (!matchesRegisteredRedirect(redirectUri, client.redirectUris))
    return { kind: "invalid_client" };

  const fail = (error: string, description?: string): AuthorizeValidation => ({
    kind: "redirect_error",
    redirectUri,
    state,
    error,
    ...(description === undefined ? {} : { description }),
  });
  if (params.response_type !== "code") return fail("unsupported_response_type");
  const challenge = params.code_challenge;
  if (
    params.code_challenge_method !== "S256" ||
    challenge === undefined ||
    !isS256Challenge(challenge)
  ) {
    return fail("invalid_request", PKCE_REQUIRED_DESCRIPTION);
  }
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

function stringsOf(body: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function isSubsetOf(value: unknown, allowed: readonly string[]): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every((item) => allowed.includes(item as string));
}

export function registerOAuthRoutes(
  app: Hono,
  options: OAuthOptions & { session: SessionConfig },
): void {
  const { issuer, store, session } = options;
  const resource = mcpResourceOf(issuer);
  const issuerOrigin = new URL(issuer).origin;
  const formLimit = bodyLimit({ maxSize: MAX_FORM_BYTES });

  const protectedResource = (c: Context) =>
    c.json({
      resource,
      authorization_servers: [issuer],
      scopes_supported: [DRAFTS_SCOPE],
      bearer_methods_supported: ["header"],
    });
  app.get("/.well-known/oauth-protected-resource/mcp", protectedResource);
  app.get("/.well-known/oauth-protected-resource", protectedResource);
  app.get("/.well-known/oauth-authorization-server", (c) =>
    c.json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      response_types_supported: RESPONSE_TYPES,
      grant_types_supported: GRANT_TYPES,
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [DRAFTS_SCOPE],
      authorization_response_iss_parameter_supported: true,
    }),
  );

  app.post("/register", formLimit, async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description: INVALID_CLIENT_METADATA_DESCRIPTION,
        },
        400,
      );
    }
    const redirectUris = body.redirect_uris;
    const urisOk =
      Array.isArray(redirectUris) &&
      redirectUris.length > 0 &&
      redirectUris.every((uri) => typeof uri === "string" && isAllowedRedirectUri(uri));
    if (!urisOk) {
      return c.json(
        { error: "invalid_redirect_uri", error_description: INVALID_REDIRECT_URI_DESCRIPTION },
        400,
      );
    }
    const authMethod = body.token_endpoint_auth_method;
    const metadataOk =
      (authMethod === undefined || authMethod === "none") &&
      isSubsetOf(body.grant_types, GRANT_TYPES) &&
      isSubsetOf(body.response_types, RESPONSE_TYPES);
    if (!metadataOk) {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description: INVALID_CLIENT_METADATA_DESCRIPTION,
        },
        400,
      );
    }
    const rawName = typeof body.client_name === "string" ? body.client_name.trim() : "";
    const client: OAuthClient = {
      clientId: randomUUID(),
      clientName: rawName.slice(0, MAX_CLIENT_NAME_LENGTH) || DEFAULT_CLIENT_NAME,
      redirectUris: redirectUris as string[],
    };
    await store.saveClient(client);
    return c.json(
      {
        client_id: client.clientId,
        client_id_issued_at: session.nowSeconds(),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: GRANT_TYPES,
        response_types: RESPONSE_TYPES,
        token_endpoint_auth_method: "none",
      },
      201,
      NO_STORE,
    );
  });

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

  app.get("/authorize", async (c) => {
    const validation = await validateAuthorize(c.req.query(), store, resource);
    if (validation.kind === "invalid_client")
      return page(c, errorPage(INVALID_CLIENT_PAGE_MESSAGE), 400);
    if (validation.kind === "redirect_error") {
      const { redirectUri, state, error, description } = validation;
      return redirectWith(c, redirectUri, { error, error_description: description, state });
    }
    const needsLogin = (await sessionAccountId(c, session)) === null;
    return page(c, consent(validation.request, needsLogin), 200);
  });

  app.post("/authorize", formLimit, async (c) => {
    // 세션만으로 허용하는 길은 SameSite=Strict가 받치고, Origin이 보이면 한 번 더 확인한다(design 3)
    const origin = c.req.header("Origin");
    if (origin !== undefined && origin !== issuerOrigin) {
      return page(c, errorPage(FORBIDDEN_ORIGIN_PAGE_MESSAGE), 403);
    }
    const form = stringsOf(await c.req.parseBody());
    const validation = await validateAuthorize(form, store, resource);
    if (validation.kind === "invalid_client")
      return page(c, errorPage(INVALID_CLIENT_PAGE_MESSAGE), 400);
    if (validation.kind === "redirect_error") {
      const { redirectUri, state, error, description } = validation;
      return redirectWith(c, redirectUri, { error, error_description: description, state });
    }
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
    if (accountId === null) return page(c, consent(request, true, LOGIN_FAILED_PAGE_MESSAGE), 401);

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

  const tokenError = (c: Context, error: string, description?: string) =>
    c.json(
      { error, ...(description === undefined ? {} : { error_description: description }) },
      400,
      NO_STORE,
    );

  const issueTokens = async (c: Context, grant: OAuthGrant) => {
    const now = session.nowSeconds();
    const accessToken = newOpaqueToken();
    const refreshToken = newOpaqueToken();
    await store.saveAccessToken(hashOpaqueToken(accessToken), {
      ...grant,
      expiresAt: now + ACCESS_TOKEN_TTL_SECONDS,
    });
    await store.saveRefreshToken(hashOpaqueToken(refreshToken), {
      ...grant,
      expiresAt: now + REFRESH_TOKEN_TTL_SECONDS,
    });
    return c.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: refreshToken,
        scope: grant.scope,
      },
      200,
      NO_STORE,
    );
  };

  const grantOf = ({
    clientId,
    accountId,
    resource: target,
    scope,
    sourceName,
  }: OAuthGrant): OAuthGrant => ({
    clientId,
    accountId,
    resource: target,
    scope,
    sourceName,
  });

  app.post("/token", formLimit, async (c) => {
    const form = stringsOf(await c.req.parseBody());
    const now = session.nowSeconds();
    const resourceMatches = (target: string) =>
      form.resource === undefined || sameResource(form.resource, target);

    if (form.grant_type === "authorization_code") {
      const {
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      } = form;
      if (
        code === undefined ||
        clientId === undefined ||
        redirectUri === undefined ||
        verifier === undefined
      ) {
        return tokenError(c, "invalid_request");
      }
      // 먼저 꺼내서 지운다 — 검증에 실패한 코드도 다시 쓸 수 없다
      const stored = await store.takeCode(hashOpaqueToken(code));
      const valid =
        stored !== null &&
        stored.expiresAt > now &&
        stored.clientId === clientId &&
        stored.redirectUri === redirectUri &&
        resourceMatches(stored.resource) &&
        verifyS256(verifier, stored.codeChallenge);
      if (!valid) return tokenError(c, "invalid_grant", INVALID_GRANT_DESCRIPTION);
      return issueTokens(c, grantOf(stored));
    }

    if (form.grant_type === "refresh_token") {
      const { refresh_token: refreshToken, client_id: clientId } = form;
      if (refreshToken === undefined || clientId === undefined)
        return tokenError(c, "invalid_request");
      // 회전 — 쓴 refresh는 지우고 새 것을 준다(OAuth 2.1 공개 클라이언트)
      const stored = await store.takeRefreshToken(hashOpaqueToken(refreshToken));
      const valid =
        stored !== null &&
        stored.expiresAt > now &&
        stored.clientId === clientId &&
        resourceMatches(stored.resource);
      if (!valid) return tokenError(c, "invalid_grant", INVALID_GRANT_DESCRIPTION);
      return issueTokens(c, grantOf(stored));
    }

    return tokenError(c, "unsupported_grant_type");
  });
}
