import { hashConnectionToken } from "./connection-tokens";
import { createMemoryConnectionTokenStore } from "./memory-connection-token-store";
import type { McpOptions } from "./route";

/** 추측으로 맞힐 수 없는 길이 — `openssl rand -hex 32`가 64자를 만든다 */
const MIN_TOKEN_LENGTH = 32;
const DEFAULT_TOKEN_NAME = "local";
// 초안 출처 `token:<name>`이 되므로 postSourceSchema와 같은 모양
const TOKEN_NAME = /^[a-z0-9-]{1,32}$/;
const DEFAULT_EDITOR_BASE_URL = "https://editor.simsimeestudio.com";

/**
 * 로컬 진입점의 `/mcp` 설정. `MCP_CONNECTION_TOKEN`이 없으면 null — `/mcp`를 열지 않는다.
 * 1단계는 토큰 하나(env)다. 발급 · 폐기 화면은 M6 설정.
 */
export function readMcpOptionsFromEnv(env: NodeJS.ProcessEnv): McpOptions | null {
  const token = env.MCP_CONNECTION_TOKEN;
  if (token === undefined || token === "") return null;
  if (token.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `MCP_CONNECTION_TOKEN은 ${MIN_TOKEN_LENGTH}자 이상이어야 한다 — openssl rand -hex 32`,
    );
  }
  const name = env.MCP_CONNECTION_TOKEN_NAME ?? DEFAULT_TOKEN_NAME;
  if (!TOKEN_NAME.test(name)) {
    throw new Error(
      `MCP_CONNECTION_TOKEN_NAME은 소문자 · 숫자 · 하이픈 1~32자 — 받은 값: "${name}"`,
    );
  }
  return {
    connectionTokens: createMemoryConnectionTokenStore([
      { name, tokenHash: hashConnectionToken(token) },
    ]),
    editorBaseUrl: env.EDITOR_BASE_URL ?? DEFAULT_EDITOR_BASE_URL,
  };
}
