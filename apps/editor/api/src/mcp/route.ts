import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Hono } from "hono";
import type { PostStore } from "../store";
import { hashConnectionToken } from "./connection-tokens";
import type { ConnectionTokenStore } from "./connection-tokens";
import { MCP_UNAUTHORIZED_MESSAGE } from "./messages";
import { createDraftsServer } from "./tools";

export interface McpOptions {
  connectionTokens: ConnectionTokenStore;
  /** 초안 응답의 에디터 링크 앞부분 — `<editorBaseUrl>/posts/<slug>/edit` */
  editorBaseUrl: string;
  /** 새 초안의 `date`. 기본은 블로그 시간대의 오늘 */
  today?: () => string;
}

const MCP_PATH = "/mcp";
const BEARER = /^Bearer\s+(\S+)$/i;
/** 글 날짜는 블로그 독자 기준 — 한국 아침에 쓴 초안이 UTC 어제로 찍히지 않게 */
const BLOG_TIME_ZONE = "Asia/Seoul";
// en-CA 로캘은 날짜를 YYYY-MM-DD로 쓴다
const ISO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: BLOG_TIME_ZONE });

function readFormatGuide(): string {
  const path = fileURLToPath(import.meta.resolve("@blog-editor/content-convert/guide/format.md"));
  return readFileSync(path, "utf8");
}

function bearerTokenOf(header: string | undefined): string | null {
  return BEARER.exec(header ?? "")?.[1] ?? null;
}

/**
 * `/mcp` — 연결용 토큰을 확인한 뒤 SDK의 무상태 fetch 핸들러에 넘긴다(adr-016). 요청마다 새 McpServer를
 * 만들므로 세션 저장소가 없고, 토큰 이름이 그 요청에서 쓴 초안의 출처(`token:<name>`)가 된다.
 */
export function registerMcpRoute(
  app: Hono,
  options: McpOptions & { store: PostStore; categories: readonly [string, ...string[]] },
): void {
  const { connectionTokens, store, categories, editorBaseUrl } = options;
  const today = options.today ?? (() => ISO_DATE_FORMAT.format(new Date()));
  const formatGuide = readFormatGuide();
  const handler = createMcpHandler(({ authInfo }) => {
    // 아래 라우트가 토큰을 확인한 요청만 넘기므로 authInfo가 없으면 배선이 잘못된 것이다
    if (authInfo === undefined) throw new Error("MCP 요청에 authInfo가 없다");
    return createDraftsServer({
      store,
      categories,
      editorBaseUrl,
      formatGuide,
      today,
      source: `token:${authInfo.clientId}`,
    });
  });

  app.all(MCP_PATH, async (c) => {
    const token = bearerTokenOf(c.req.header("Authorization"));
    const found =
      token === null ? null : await connectionTokens.findByHash(hashConnectionToken(token));
    if (token === null || found === null) {
      c.header("WWW-Authenticate", 'Bearer realm="mcp"');
      return c.json({ message: MCP_UNAUTHORIZED_MESSAGE }, 401);
    }
    return handler.fetch(c.req.raw, {
      authInfo: { token, clientId: found.name, scopes: ["drafts"] },
    });
  });
}
