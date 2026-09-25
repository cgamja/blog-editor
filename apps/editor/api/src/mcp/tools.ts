import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { convertMarkdown, serializeMarkdown } from "@blog-editor/content-convert";
import {
  SCHEMA_VERSION,
  checkSeo,
  createPostFileSchema,
  normalize,
  slugSchema,
} from "@blog-editor/content-schema";
import type { Doc, PostFile, PostSource, SeoFinding, SeoInput } from "@blog-editor/content-schema";
import { MAX_MARKDOWN_LENGTH } from "../input-limits";
import type { SettingsStore } from "../settings-store";
import { ConflictError } from "../store";
import type { PostStore } from "../store";
import {
  MCP_CONFLICT_MESSAGE,
  MCP_INTERNAL_ERROR_MESSAGE,
  MCP_META_MISMATCH_MESSAGE,
  MCP_POST_NOT_FOUND_MESSAGE,
  MCP_PUBLISHED_READ_ONLY_MESSAGE,
  MCP_SERVER_INSTRUCTIONS,
  MCP_SLUG_TAKEN_MESSAGE,
  MCP_TOOL_TEXT,
  MCP_WORKSPACE_GUIDE_HEADING,
} from "./messages";

export interface DraftToolsOptions {
  store: PostStore;
  categories: readonly [string, ...string[]];
  editorBaseUrl: string;
  /** 형식 가이드 원문(content-convert `guide/format.md`) */
  formatGuide: string;
  /** 워크스페이스 글쓰기 가이드 — 사람이 AI 연결 화면에서 저장한다 */
  settings: SettingsStore;
  /** 새 초안의 `date`(YYYY-MM-DD) */
  today: () => string;
  /** 이 요청을 보낸 연결용 토큰에서 온 초안 출처 */
  source: PostSource;
}

const SERVER_INFO = { name: "simsimee-blog-editor", version: "0.1.0" };
const markdownSchema = z.string().max(MAX_MARKDOWN_LENGTH);

/** 형식 가이드(문법) 뒤에 이 블로그의 글쓰기 가이드(말투 · 독자 · 구성)를 붙인다 */
function withWorkspaceGuide(formatGuide: string, guide: string): string {
  return `${formatGuide.trimEnd()}\n\n${MCP_WORKSPACE_GUIDE_HEADING}\n\n${guide.trim()}\n`;
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function jsonResult(value: unknown): CallToolResult {
  return textResult(JSON.stringify(value, null, 2));
}

function toolError(text: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

/**
 * 도구 핸들러 공통 경계. 충돌은 도구마다 다른 안내로, 그 밖의 예외는 파일 경로 같은 서버 내부가 담길 수
 * 있어 AI에게는 고정 문구만 주고 원문은 서버 로그에 남긴다.
 */
function guarded<Args extends unknown[]>(
  run: (...args: Args) => Promise<CallToolResult>,
  conflictMessage: string = MCP_INTERNAL_ERROR_MESSAGE,
): (...args: Args) => Promise<CallToolResult> {
  return async (...args) => {
    try {
      return await run(...args);
    } catch (error) {
      if (error instanceof ConflictError) return toolError(conflictMessage);
      console.error("mcp: 도구 실패", error);
      return toolError(MCP_INTERNAL_ERROR_MESSAGE);
    }
  };
}

function byDateDesc(a: { date: string; slug: string }, b: { date: string; slug: string }): number {
  return b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);
}

/**
 * 도구 6개(plan 3-12). 쓰기 도구 응답에는 SEO 점검 `seo`가 늘 붙는다(adr-030). 발행 · 삭제 도구는 만들지 않는다 — 이것이 안전 경계다(adr-007). 쓰기 도구는
 * 입력에 `draft` 자리가 없고(strictObject라 넣으면 입력 오류) 저장하는 글을 항상 `draft: true`로 둔다.
 */
export function createDraftsServer(options: DraftToolsOptions): McpServer {
  const { store, categories, editorBaseUrl, formatGuide, settings, today, source } = options;
  const postFileSchema = createPostFileSchema({ categories });
  // instructions는 초기화 응답에 실린다 — @modelcontextprotocol/server 2.0 ServerOptions.instructions
  // (dist/createMcpHandler-*.d.mts "Optional instructions describing how to use the server")
  const server = new McpServer(SERVER_INFO, { instructions: MCP_SERVER_INSTRUCTIONS });

  const editorUrlOf = (slug: string) => `${editorBaseUrl}/posts/${slug}/edit`;

  /** 글 내용 SEO 점검(adr-030) — 비교 대상은 저장된 다른 글 전부(초안 포함)다 */
  async function seoOf(
    slug: string | undefined,
    meta: SeoInput["meta"],
    doc: Doc,
  ): Promise<SeoFinding[]> {
    // 목록은 저장소가 검증 없이 돌려준 요약이다 — 모양이 어긋난 항목은 비교에서 뺀다
    const others = (await store.list()).flatMap(({ slug: other, meta: summary }) =>
      typeof summary.title === "string"
        ? [
            {
              slug: other,
              title: summary.title,
              description:
                typeof summary.description === "string" ? summary.description : undefined,
            },
          ]
        : [],
    );
    return checkSeo({ slug, meta, doc, others });
  }

  /**
   * 저장한 뒤의 점검 — 이미 저장됐으므로 점검이 실패해도 성공 응답을 막지 않는다(`seo: null`은 "점검 못 함").
   * 원문은 서버 로그에만 남긴다(guarded와 같은 이유).
   */
  async function seoAfterSave(slug: string, file: PostFile): Promise<SeoFinding[] | null> {
    try {
      return await seoOf(slug, file.meta, file.doc);
    } catch (error) {
      console.error("mcp: SEO 점검 실패", error);
      return null;
    }
  }

  /** 실패하면 AI가 고칠 수 있게 변환 · 검증 메시지를 그대로 돌려준다 */
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
      ...MCP_TOOL_TEXT.get_writing_guide,
    },
    guarded(async () => {
      const { guide } = await settings.get();
      return textResult(guide.trim() === "" ? formatGuide : withWorkspaceGuide(formatGuide, guide));
    }),
  );

  server.registerTool(
    "list_posts",
    {
      ...MCP_TOOL_TEXT.list_posts,
    },
    guarded(async () => {
      const posts = (await store.list()).map(({ slug, meta }) => ({
        slug,
        title: meta.title,
        draft: meta.draft,
        date: meta.date,
        category: meta.category,
      }));
      return jsonResult({ posts: posts.sort(byDateDesc) });
    }),
  );

  server.registerTool(
    "get_post",
    {
      ...MCP_TOOL_TEXT.get_post,
      inputSchema: z.strictObject({ slug: slugSchema }),
    },
    guarded(async ({ slug }) => {
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
    }),
  );

  server.registerTool(
    "check_draft",
    {
      ...MCP_TOOL_TEXT.check_draft,
      // create_draft와 같은 인자를 그대로 넘겨도 되게 아래 밖의 키는 무시한다
      inputSchema: z.object({
        markdown: markdownSchema,
        slug: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        keyword: z.string().optional(),
      }),
    },
    guarded(async ({ markdown, slug, title, description, keyword }) => {
      const converted = convertMarkdown(markdown);
      if (!converted.ok) return toolError(converted.messages.join("\n"));
      const meta = { title: title ?? "", description: description ?? "", keyword };
      const given = { title: title !== undefined, description: description !== undefined };
      // 주지 않은 칸의 규칙은 빈 값 때문에 걸린 것이라 뺀다 — keyword-missing(info)은 주지 않은 것 자체를 알린다
      const isAboutGivenField = ({ target }: SeoFinding) =>
        target.kind !== "meta" || target.field === "keyword" || given[target.field];
      const seo = (await seoOf(slug, meta, normalize(converted.doc))).filter(isAboutGivenField);
      return jsonResult({ ok: true, blocks: converted.doc.content.length, seo });
    }),
  );

  server.registerTool(
    "create_draft",
    {
      ...MCP_TOOL_TEXT.create_draft,
      inputSchema: z.strictObject({
        slug: slugSchema,
        title: z.string(),
        description: z.string(),
        category: z.enum(categories),
        markdown: markdownSchema,
        keyword: z.string().optional(),
      }),
    },
    guarded(async ({ slug, title, description, category, markdown, keyword }) => {
      const meta = {
        title,
        description,
        date: today(),
        category,
        draft: true,
        source,
        ...(keyword === undefined ? {} : { keyword }),
      };
      const built = buildFile(markdown, meta);
      if (!built.ok) return built.error;
      const { revision } = await store.put(slug, built.file, null);
      const seo = await seoAfterSave(slug, built.file);
      return jsonResult({ slug, revision, editorUrl: editorUrlOf(slug), seo });
    }, MCP_SLUG_TAKEN_MESSAGE),
  );

  server.registerTool(
    "update_draft",
    {
      ...MCP_TOOL_TEXT.update_draft,
      inputSchema: z.strictObject({
        slug: slugSchema,
        revision: z.string(),
        markdown: markdownSchema,
        title: z.string().optional(),
        description: z.string().optional(),
        category: z.enum(categories).optional(),
        keyword: z.string().optional(),
      }),
    },
    guarded(async ({ slug, revision, markdown, title, description, category, keyword }) => {
      const found = await store.get(slug);
      if (found === null) return toolError(MCP_POST_NOT_FOUND_MESSAGE);
      // 초안인지 확인한 판과 조건부로 쓰는 판을 같게 둔다 — 다르면 확인하지 않은 판(발행 글)을 덮을 수 있다
      if (revision !== found.revision) return toolError(MCP_CONFLICT_MESSAGE);
      if (found.file.meta.draft !== true) return toolError(MCP_PUBLISHED_READ_ONLY_MESSAGE);
      // date · source는 처음 쓴 쪽의 것을 지킨다 — 고친 AI가 출처를 바꾸지 않는다
      const meta = {
        ...found.file.meta,
        ...(title === undefined ? {} : { title }),
        ...(description === undefined ? {} : { description }),
        ...(category === undefined ? {} : { category }),
        ...(keyword === undefined ? {} : { keyword }),
        draft: true,
      };
      const built = buildFile(markdown, meta);
      if (!built.ok) return built.error;
      const saved = await store.put(slug, built.file, found.revision);
      const seo = await seoAfterSave(slug, built.file);
      return jsonResult({ slug, revision: saved.revision, editorUrl: editorUrlOf(slug), seo });
    }, MCP_CONFLICT_MESSAGE),
  );

  return server;
}
