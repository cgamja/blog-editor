import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { convertMarkdown, serializeMarkdown } from "@blog-editor/content-convert";
import {
  SCHEMA_VERSION,
  createPostFileSchema,
  normalize,
  slugSchema,
} from "@blog-editor/content-schema";
import type { PostFile, PostSource } from "@blog-editor/content-schema";
import { ConflictError } from "../store";
import type { PostStore } from "../store";
import {
  MCP_CONFLICT_MESSAGE,
  MCP_META_MISMATCH_MESSAGE,
  MCP_POST_NOT_FOUND_MESSAGE,
  MCP_PUBLISHED_READ_ONLY_MESSAGE,
  MCP_SLUG_TAKEN_MESSAGE,
} from "./messages";

export interface DraftToolsOptions {
  store: PostStore;
  categories: readonly [string, ...string[]];
  editorBaseUrl: string;
  /** 형식 가이드 원문(content-convert `guide/format.md`) */
  formatGuide: string;
  /** 새 초안의 `date`(YYYY-MM-DD) */
  today: () => string;
  /** 이 요청을 보낸 연결용 토큰에서 온 초안 출처 */
  source: PostSource;
}

const SERVER_INFO = { name: "simsimee-blog-editor", version: "0.1.0" };

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function jsonResult(value: unknown): CallToolResult {
  return textResult(JSON.stringify(value, null, 2));
}

function toolError(text: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

function byDateDesc(a: { date: string; slug: string }, b: { date: string; slug: string }): number {
  return b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);
}

/**
 * 도구 6개(plan 3-12). 발행 · 삭제 도구는 만들지 않는다 — 이것이 안전 경계다(adr-007). 쓰기 도구는
 * 입력에 `draft` 자리가 없고(strictObject라 넣으면 입력 오류) 저장하는 글을 항상 `draft: true`로 둔다.
 */
export function createDraftsServer(options: DraftToolsOptions): McpServer {
  const { store, categories, editorBaseUrl, formatGuide, today, source } = options;
  const postFileSchema = createPostFileSchema({ categories });
  const server = new McpServer(SERVER_INFO);

  const editorUrlOf = (slug: string) => `${editorBaseUrl}/posts/${slug}/edit`;

  /** 변환 → 글 파일 검증 → 정규화. 실패하면 AI가 고칠 수 있게 메시지를 그대로 돌려준다. */
  function buildFile(
    markdown: string,
    meta: PostFile["meta"],
  ): { ok: true; file: PostFile } | { ok: false; error: CallToolResult } {
    const converted = convertMarkdown(markdown);
    if (!converted.ok) return { ok: false, error: toolError(converted.messages.join("\n")) };
    const parsed = postFileSchema.safeParse({
      schemaVersion: SCHEMA_VERSION,
      meta,
      doc: converted.doc,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        ({ path, message }) => `- ${path.map(String).join(".")}: ${message}`,
      );
      return { ok: false, error: toolError([MCP_META_MISMATCH_MESSAGE, ...issues].join("\n")) };
    }
    return { ok: true, file: { ...parsed.data, doc: normalize(parsed.data.doc) } };
  }

  server.registerTool(
    "get_writing_guide",
    {
      title: "글쓰기 가이드",
      description:
        "초안을 쓰기 전에 가장 먼저 읽는다. 블록 문법 · 콜아웃 · 꾸미기 지시어 · 이미지 규칙을 담은 형식 가이드다.",
    },
    async () => textResult(formatGuide),
  );

  server.registerTool(
    "list_posts",
    {
      title: "글 목록",
      description: "초안과 발행된 글의 요약(slug · 제목 · 초안 여부 · 날짜 · 카테고리). 읽기 전용.",
    },
    async () => {
      const posts = (await store.list()).map(({ slug, meta }) => ({
        slug,
        title: meta.title,
        draft: meta.draft,
        date: meta.date,
        category: meta.category,
      }));
      return jsonResult({ posts: posts.sort(byDateDesc) });
    },
  );

  server.registerTool(
    "get_post",
    {
      title: "글 읽기",
      description:
        "글 하나를 markdown으로 읽는다. update_draft에 넘길 revision과, markdown으로 옮기지 못한 것(losses)을 함께 준다.",
      inputSchema: z.strictObject({ slug: slugSchema }),
    },
    async ({ slug }) => {
      const found = await store.get(slug);
      if (found === null) return toolError(MCP_POST_NOT_FOUND_MESSAGE);
      const { markdown, losses } = serializeMarkdown(found.file.doc);
      return jsonResult({
        slug,
        revision: found.revision,
        meta: found.file.meta,
        markdown,
        losses,
      });
    },
  );

  server.registerTool(
    "check_draft",
    {
      title: "형식 검사",
      description: "저장하지 않고 markdown 형식만 검사해 틀린 곳을 알려준다.",
      // create_draft와 같은 인자를 그대로 넘겨도 되게 markdown 외의 키는 무시한다
      inputSchema: z.object({ markdown: z.string() }),
    },
    async ({ markdown }) => {
      const converted = convertMarkdown(markdown);
      if (!converted.ok) return toolError(converted.messages.join("\n"));
      return jsonResult({ ok: true, blocks: converted.doc.content.length });
    },
  );

  server.registerTool(
    "create_draft",
    {
      title: "초안 만들기",
      description:
        "markdown과 글 정보로 새 초안을 저장한다. 항상 초안이고 발행은 사람이 에디터에서 한다. 응답의 editorUrl을 사용자에게 알려준다.",
      inputSchema: z.strictObject({
        slug: slugSchema,
        title: z.string(),
        description: z.string(),
        category: z.enum(categories),
        markdown: z.string(),
      }),
    },
    async ({ slug, title, description, category, markdown }) => {
      const meta = { title, description, date: today(), category, draft: true, source };
      const built = buildFile(markdown, meta);
      if (!built.ok) return built.error;
      try {
        const { revision } = await store.put(slug, built.file, null);
        return jsonResult({ slug, revision, editorUrl: editorUrlOf(slug) });
      } catch (error) {
        if (error instanceof ConflictError) return toolError(MCP_SLUG_TAKEN_MESSAGE);
        throw error;
      }
    },
  );

  server.registerTool(
    "update_draft",
    {
      title: "초안 고치기",
      description:
        "get_post로 받은 revision으로 초안을 고쳐 쓴다. 그사이 바뀌었으면 충돌이다. 발행된 글은 고치지 못한다.",
      inputSchema: z.strictObject({
        slug: slugSchema,
        revision: z.string(),
        markdown: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        category: z.enum(categories).optional(),
      }),
    },
    async ({ slug, revision, markdown, title, description, category }) => {
      const found = await store.get(slug);
      if (found === null) return toolError(MCP_POST_NOT_FOUND_MESSAGE);
      if (found.file.meta.draft !== true) return toolError(MCP_PUBLISHED_READ_ONLY_MESSAGE);
      // date · source는 처음 쓴 쪽의 것을 지킨다 — 고친 AI가 출처를 바꾸지 않는다
      const meta = {
        ...found.file.meta,
        ...(title === undefined ? {} : { title }),
        ...(description === undefined ? {} : { description }),
        ...(category === undefined ? {} : { category }),
        draft: true,
      };
      const built = buildFile(markdown, meta);
      if (!built.ok) return built.error;
      try {
        const saved = await store.put(slug, built.file, revision);
        return jsonResult({ slug, revision: saved.revision, editorUrl: editorUrlOf(slug) });
      } catch (error) {
        if (error instanceof ConflictError) return toolError(MCP_CONFLICT_MESSAGE);
        throw error;
      }
    },
  );

  return server;
}
