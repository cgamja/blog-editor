import { randomUUID } from "node:crypto";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { SessionConfig } from "../../session";
import { DRAFTS_SCOPE } from "../constants";
import { registerAuthorizeRoutes } from "./authorize";
import { GRANT_TYPES, MAX_FORM_BYTES, NO_STORE_HEADERS, RESPONSE_TYPES } from "./constants";
import {
  DEFAULT_CLIENT_NAME,
  INVALID_CLIENT_METADATA_DESCRIPTION,
  INVALID_REDIRECT_URI_DESCRIPTION,
} from "./messages";
import { isAllowedRedirectUri } from "./redirect-uris";
import type { OAuthClient } from "./store";
import { registerTokenRoute } from "./token";
import { mcpResourceOf } from "./tokens";
import type { OAuthOptions } from "./types";

const MAX_CLIENT_NAME_LENGTH = 100;

function isSubsetOf(value: unknown, allowed: readonly string[]): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every((item) => allowed.includes(item as string));
}

function registrationError(c: Context, error: string, description: string, status: 400) {
  return c.json({ error, error_description: description }, status, NO_STORE_HEADERS);
}

/**
 * 같은 서비스가 인가 서버가 된다(adr-018) — 메타데이터(RFC 9728 · 8414) · 동적 등록(RFC 7591)은 여기,
 * 사람의 인가는 authorize.ts, 코드 · refresh 교환은 token.ts.
 */
export function registerOAuthRoutes(
  app: Hono,
  options: OAuthOptions & { session: SessionConfig },
): void {
  const { issuer, store, session } = options;
  const resource = mcpResourceOf(issuer);

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

  app.post("/register", bodyLimit({ maxSize: MAX_FORM_BYTES }), async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return registrationError(
        c,
        "invalid_client_metadata",
        INVALID_CLIENT_METADATA_DESCRIPTION,
        400,
      );
    }
    const redirectUris = body.redirect_uris;
    const urisAllowed =
      Array.isArray(redirectUris) &&
      redirectUris.length > 0 &&
      redirectUris.every((uri) => typeof uri === "string" && isAllowedRedirectUri(uri));
    if (!urisAllowed) {
      return registrationError(c, "invalid_redirect_uri", INVALID_REDIRECT_URI_DESCRIPTION, 400);
    }
    const authMethod = body.token_endpoint_auth_method;
    const isPublicCodeClient =
      (authMethod === undefined || authMethod === "none") &&
      isSubsetOf(body.grant_types, GRANT_TYPES) &&
      isSubsetOf(body.response_types, RESPONSE_TYPES);
    if (!isPublicCodeClient) {
      return registrationError(
        c,
        "invalid_client_metadata",
        INVALID_CLIENT_METADATA_DESCRIPTION,
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
      NO_STORE_HEADERS,
    );
  });

  registerAuthorizeRoutes(app, options);
  registerTokenRoute(app, options);
}
