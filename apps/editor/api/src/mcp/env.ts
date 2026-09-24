import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { postSourceSchema } from "@blog-editor/content-schema";
import { hashConnectionToken } from "./connection-tokens";
import { createMemoryConnectionTokenStore } from "./memory-connection-token-store";
import type { McpOptions } from "./route";

/** 추측으로 맞힐 수 없는 길이 — `openssl rand -hex 32`가 64자를 만든다 */
const MIN_TOKEN_LENGTH = 32;
const DEFAULT_TOKEN_NAME = "local";
// Authorization 헤더 값으로 그대로 실리므로 공백이 끼면 Bearer 파싱이 다른 토큰을 본다
const TOKEN_CHARS = /^\S+$/;
const DEFAULT_EDITOR_BASE_URL = "https://editor.simsimeestudio.com";

function readFormatGuide(): string {
  const path = fileURLToPath(import.meta.resolve("@blog-editor/content-convert/guide/format.md"));
  return readFileSync(path, "utf8");
}

/**
 * 로컬 진입점의 `/mcp` 설정. `MCP_CONNECTION_TOKEN`이 없으면 null — `/mcp`를 열지 않는다.
 * 1단계는 토큰 하나(env)다. 발급 · 폐기 화면은 M6 설정. 형식 가이드 파일(guide/format.md)도 여기서 읽는다.
 */
export function readMcpOptionsFromEnv(env: NodeJS.ProcessEnv): McpOptions | null {
  const token = env.MCP_CONNECTION_TOKEN;
  if (token === undefined || token === "") return null;
  if (token.length < MIN_TOKEN_LENGTH || !TOKEN_CHARS.test(token)) {
    throw new Error(
      `MCP_CONNECTION_TOKEN은 ${MIN_TOKEN_LENGTH}자 이상 · 공백 없이 — openssl rand -hex 32`,
    );
  }
  const name = env.MCP_CONNECTION_TOKEN_NAME || DEFAULT_TOKEN_NAME;
  // 이름은 초안 출처 `token:<name>`이 된다 — 모양 규칙은 출처 스키마 한 곳에 있다
  const source = postSourceSchema.safeParse(`token:${name}`);
  if (!source.success) {
    const reason = source.error.issues.map((issue) => issue.message).join(" · ");
    throw new Error(`MCP_CONNECTION_TOKEN_NAME이 틀렸다(${reason}) — 받은 값: "${name}"`);
  }
  return {
    connectionTokens: createMemoryConnectionTokenStore([
      { name, tokenHash: hashConnectionToken(token) },
    ]),
    // 빈 문자열로 설정돼도 링크가 `/posts/...`처럼 깨지지 않게 기본값을 쓴다
    editorBaseUrl: env.EDITOR_BASE_URL || DEFAULT_EDITOR_BASE_URL,
    formatGuide: readFormatGuide(),
  };
}
