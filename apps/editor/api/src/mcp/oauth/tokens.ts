import { randomBytes } from "node:crypto";
// 코드 · 토큰도 무작위 고엔트로피 문자열이라 연결용 토큰과 같은 이유로 SHA-256만 남긴다(adr-016)
import { hashConnectionToken as hashOpaqueToken } from "../connection-tokens";
import type { OAuthOptions } from "./types";

export { hashOpaqueToken };

const TOKEN_BYTES = 32;

export function newOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function mcpResourceOf(issuer: string): string {
  return `${issuer}/mcp`;
}

export function protectedResourceMetadataUrl(issuer: string): string {
  return `${issuer}/.well-known/oauth-protected-resource/mcp`;
}

/** RFC 8707 — 끝 `/` 하나는 같은 자원으로 본다 */
export function sameResource(requested: string, resource: string): boolean {
  return requested.replace(/\/$/, "") === resource;
}

/**
 * `/mcp`가 부른다 — 살아 있고 이 서버의 MCP URL로 발급된 액세스 토큰이면 초안 출처 이름, 아니면 null.
 * 만료는 저장소가 거른다.
 */
export async function findAccessTokenSourceName(
  { issuer, store }: OAuthOptions,
  token: string,
  nowSeconds: number,
): Promise<string | null> {
  const found = await store.findAccessToken(hashOpaqueToken(token), nowSeconds);
  if (found === null || found.resource !== mcpResourceOf(issuer)) return null;
  return found.sourceName;
}
