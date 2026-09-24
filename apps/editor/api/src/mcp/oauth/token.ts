import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { SessionConfig } from "../../session";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  MAX_FORM_BYTES,
  NO_STORE_HEADERS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./constants";
import { formStrings } from "./form";
import { INVALID_GRANT_DESCRIPTION } from "./messages";
import { verifyS256 } from "./pkce";
import type { OAuthGrant, OAuthStore } from "./store";
import { hashOpaqueToken, newOpaqueToken, sameResource } from "./tokens";
import type { OAuthOptions } from "./types";

type TokenForm = Readonly<Record<string, string | undefined>>;

/** 성공이면 새 토큰 쌍을 줄 권한, 실패면 RFC 6749 5.2 error 코드 */
type GrantResult = { ok: true; grant: OAuthGrant } | { ok: false; error: string };

const invalidGrant: GrantResult = { ok: false, error: "invalid_grant" };

function grantOf({ clientId, accountId, resource, scope, sourceName }: OAuthGrant): OAuthGrant {
  return { clientId, accountId, resource, scope, sourceName };
}

function resourceMatches(form: TokenForm, resource: string): boolean {
  return form.resource === undefined || sameResource(form.resource, resource);
}

/** 코드 교환 — 코드는 먼저 꺼내서 지운다. 검증에 실패한 코드도 다시 쓸 수 없다 */
async function exchangeAuthorizationCode(
  store: OAuthStore,
  form: TokenForm,
  nowSeconds: number,
): Promise<GrantResult> {
  const { code, client_id: clientId, redirect_uri: redirectUri, code_verifier: verifier } = form;
  if (
    code === undefined ||
    clientId === undefined ||
    redirectUri === undefined ||
    verifier === undefined
  ) {
    return { ok: false, error: "invalid_request" };
  }
  const stored = await store.takeCode(hashOpaqueToken(code));
  const valid =
    stored !== null &&
    stored.expiresAt > nowSeconds &&
    stored.clientId === clientId &&
    stored.redirectUri === redirectUri &&
    resourceMatches(form, stored.resource) &&
    verifyS256(verifier, stored.codeChallenge);
  return valid ? { ok: true, grant: grantOf(stored) } : invalidGrant;
}

/** refresh 회전 — 쓴 refresh는 지우고 새 쌍을 준다(OAuth 2.1 공개 클라이언트) */
async function rotateRefreshToken(
  store: OAuthStore,
  form: TokenForm,
  nowSeconds: number,
): Promise<GrantResult> {
  const { refresh_token: refreshToken, client_id: clientId } = form;
  if (refreshToken === undefined || clientId === undefined) {
    return { ok: false, error: "invalid_request" };
  }
  const stored = await store.takeRefreshToken(hashOpaqueToken(refreshToken));
  const valid =
    stored !== null &&
    stored.expiresAt > nowSeconds &&
    stored.clientId === clientId &&
    resourceMatches(form, stored.resource);
  return valid ? { ok: true, grant: grantOf(stored) } : invalidGrant;
}

/** `/token` — grant_type으로만 나누고, 규칙은 위 두 함수가 갖는다(mcp-oauth-grant) */
export function registerTokenRoute(
  app: Hono,
  { store, session }: OAuthOptions & { session: SessionConfig },
): void {
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
      NO_STORE_HEADERS,
    );
  };

  app.post("/token", bodyLimit({ maxSize: MAX_FORM_BYTES }), async (c) => {
    const form = await formStrings(c);
    const now = session.nowSeconds();
    let result: GrantResult;
    if (form.grant_type === "authorization_code") {
      result = await exchangeAuthorizationCode(store, form, now);
    } else if (form.grant_type === "refresh_token") {
      result = await rotateRefreshToken(store, form, now);
    } else {
      result = { ok: false, error: "unsupported_grant_type" };
    }
    if (result.ok) return issueTokens(c, result.grant);
    const description = result.error === "invalid_grant" ? INVALID_GRANT_DESCRIPTION : undefined;
    return c.json(
      {
        error: result.error,
        ...(description === undefined ? {} : { error_description: description }),
      },
      400,
      NO_STORE_HEADERS,
    );
  });
}
