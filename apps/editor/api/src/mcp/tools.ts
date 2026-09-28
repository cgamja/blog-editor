import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  RANGE_EDIT_COMMANDS,
  convertMarkdown,
  editDocRange,
  serializeMarkdown,
} from "@blog-editor/content-convert";
import type { RangeEdit } from "@blog-editor/content-convert";
import {
  SCHEMA_VERSION,
  checkSeo,
  scoreSeo,
  seoOthersOf,
  createPostFileSchema,
  normalize,
  slugSchema,
} from "@blog-editor/content-schema";
import type { Doc, PostFile, PostSource, SeoFinding, SeoInput } from "@blog-editor/content-schema";
import { revertAiEdit } from "../ai-undo";
import type { AiUndoEntry, AiUndoStore } from "../ai-undo-store";
import { MAX_GUIDE_LENGTH, MAX_MARKDOWN_LENGTH } from "../input-limits";
import type { ImageStore } from "../image-store";
import type { SettingsStore } from "../settings-store";
import { ConflictError } from "../store";
import type { PostStore } from "../store";
import {
  MCP_CONFLICT_MESSAGE,
  MCP_EDIT_WITH_MARKDOWN_MESSAGE,
  MCP_GUIDE_WITH_FORMAT_MESSAGE,
  MCP_INTERNAL_ERROR_MESSAGE,
  MCP_META_MISMATCH_MESSAGE,
  MCP_NOTHING_TO_UPDATE_MESSAGE,
  MCP_POST_NOT_FOUND_MESSAGE,
  MCP_PREVIEW_BROWSER_MISSING_MESSAGE,
  MCP_PUBLISHED_READ_ONLY_MESSAGE,
  MCP_REVERT_UNAVAILABLE_MESSAGES,
  MCP_SERVER_INSTRUCTIONS,
  MCP_SLUG_TAKEN_MESSAGE,
  MCP_TOOL_TEXT,
  MCP_WORKSPACE_GUIDE_HEADING,
  previewPartNote,
  previewPartOutOfRangeMessage,
} from "./messages";
import { capturePreview } from "./preview-capture";
import { previewPageHtml } from "./preview-page";

export interface DraftToolsOptions {
  store: PostStore;
  categories: readonly [string, ...string[]];
  editorBaseUrl: string;
  /** 형식 가이드 원문(content-convert `guide/format.md`) */
  formatGuide: string;
  /** 워크스페이스 글쓰기 가이드 — 사람이 AI 연결 화면에서 저장한다 */
  settings: SettingsStore;
  /** 글마다 마지막 AI 저장(ADR-041) — 쓰기 도구가 남기고 revert_draft · 편집 화면이 되돌린다 */
  aiUndo: AiUndoStore;
  /** 새 초안의 `date`(YYYY-MM-DD) */
  today: () => string;
  /** 이 요청을 보낸 연결용 토큰에서 온 초안 출처 */
  source: PostSource;
  /** preview_post가 찍는 문서의 재료 — 공개 렌더와 같은 imageBaseUrl · post.css, 올린 이미지 저장소(있으면) */
  preview: { imageBaseUrl: string; postCss: string; images?: ImageStore };
}

const SERVER_INFO = { name: "simsimee-blog-editor", version: "0.1.0" };
const markdownSchema = z.string().max(MAX_MARKDOWN_LENGTH);
/**
 * 도구 표시(ToolAnnotations — @modelcontextprotocol/core `ToolAnnotationsSchema`,
 * https://modelcontextprotocol.io/specification/2025-11-25/schema#toolannotations).
 * 클라이언트(Codex `default_tools_approval_mode = "writes"` 등)는 readOnlyHint로 확인 없이 부를 도구를 고른다.
 * openWorldHint: false — 이 서버의 글 저장소 · 설정만 만지고 바깥 세계(웹 등)에 닿지 않는다.
 */
const READ_ONLY_TOOL = { readOnlyHint: true, openWorldHint: false } as const;
/** 새 초안만 만든다 — 같은 slug가 있으면 거절(조건부 생성)하므로 덮어쓰지 않고, 같은 인자로 다시 불러도 더 바뀌는 것이 없다 */
const CREATE_DRAFT_TOOL = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
/** 초안 내용을 바꿔 쓴다(이전 본문 · 글 정보가 사라진다 → destructive). revision을 맞춰야 쓰므로 같은 인자로 다시 부르면 충돌로 거절되거나 같은 내용이 된다 */
const UPDATE_DRAFT_TOOL = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;
/**
 * 마지막 AI 저장을 그 직전 판으로 되돌린다(지금 본문이 사라진다 → destructive). 되돌린 뒤 남긴 판을 지우므로
 * 같은 인자로 다시 부르면 글은 더 바뀌지 않고 실패로 알린다
 */
const REVERT_DRAFT_TOOL = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;
/** 워크스페이스 글쓰기 가이드 전체를 바꿔 쓴다(이전 가이드가 사라진다 → destructive). 같은 인자로 다시 부르면 같은 가이드다 */
const UPDATE_GUIDE_TOOL = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;
/** 부분 고치기(adr-031) — 범위는 "시작 글...끝 글", 새 글은 markdown */
const rangeEditSchema = z.strictObject({
  command: z.enum(RANGE_EDIT_COMMANDS),
  selection: z.string().min(1).max(MAX_MARKDOWN_LENGTH),
  markdown: markdownSchema,
});

type BuiltFile = { ok: true; file: PostFile } | { ok: false; error: CallToolResult };

/** 형식 가이드(문법) 뒤에 이 블로그의 글쓰기 가이드(말투 · 독자 · 구성)를 붙인다 */
function withWorkspaceGuide(formatGuide: string, guide: string): string {
  return `${formatGuide.trimEnd()}\n\n${MCP_WORKSPACE_GUIDE_HEADING}\n\n${guide.trim()}\n`;
}

/** 형식 가이드의 첫 제목 줄 — 워크스페이스 가이드에 섞여 들어왔는지 가리는 표지 */
function firstLineOf(text: string): string {
  return (
    text
      .split("\n")
      .find((line) => line.trim() !== "")
      ?.trim() ?? ""
  );
}

/**
 * get_writing_guide 응답을 통째로(또는 워크스페이스 가이드 제목째) 보냈는가 — 그대로 저장하면 다음 응답에
 * 형식 가이드 · 제목이 두 번 붙는다. 워크스페이스 가이드는 그 제목 아래 부분만이다.
 */
function mixesFormatGuide(guide: string, formatGuide: string): boolean {
  const markers = [MCP_WORKSPACE_GUIDE_HEADING, firstLineOf(formatGuide)].filter((m) => m !== "");
  return guide.split("\n").some((line) => markers.includes(line.trim()));
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
 * 도구 9개(plan 3-12 + 글쓰기 가이드 고치기 #143 + AI 수정 되돌리기 #186 + 미리보기 이미지 #139). 쓰기 도구 응답에는 SEO 점검 `seo`가 늘 붙는다(adr-030). 발행 · 삭제 도구는 만들지 않는다 — 이것이 안전 경계다(adr-007). 쓰기 도구는
 * 입력에 `draft` 자리가 없고(strictObject라 넣으면 입력 오류) 저장하는 글을 항상 `draft: true`로 둔다.
 */
export function createDraftsServer(options: DraftToolsOptions): McpServer {
  const {
    store,
    categories,
    editorBaseUrl,
    formatGuide,
    settings,
    aiUndo,
    today,
    source,
    preview,
  } = options;
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
    // 에디터 발행 확인과 같은 함수로 비교 대상을 만든다 — 같은 글이면 같은 점수(adr-034)
    const summaries = (await store.list()).map(({ slug: other, meta: summary }) => ({
      slug: other,
      title: summary.title,
      description: summary.description,
    }));
    return checkSeo({ slug, meta, doc, others: seoOthersOf(summaries) });
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

  /**
   * AI 저장이 성공한 뒤 되돌릴 판을 남긴다(ADR-041). 글은 이미 저장됐으므로 남기기가 실패해도 성공 응답을 막지
   * 않는다 — 옛 판이 남아도 그 after가 지금 revision과 달라 되돌리기는 거절된다. 원문은 서버 로그에만.
   */
  async function rememberAiSave(slug: string, entry: AiUndoEntry): Promise<void> {
    try {
      await aiUndo.put(slug, entry);
    } catch (error) {
      console.error("mcp: 되돌릴 판 남기기 실패", error);
    }
  }

  /** seo와 seoScore는 늘 함께 null이다 — 클라이언트는 하나만 보고 "점검 못 함"을 안다(adr-034) */
  const seoReport = (seo: SeoFinding[] | null) => ({
    seo,
    seoScore: seo === null ? null : scoreSeo(seo),
  });

  /** 실패하면 AI가 고칠 수 있게 변환 · 검증 메시지를 그대로 돌려준다 */
  function buildFile(markdown: string, meta: PostFile["meta"]): BuiltFile {
    const converted = convertMarkdown(markdown);
    if (!converted.ok) return { ok: false, error: toolError(converted.messages.join("\n")) };
    return fileOf(converted.doc, meta);
  }

  /** 문서 · 글 정보를 저장할 모양으로 검증한다 — 부분 고치기 · 글 정보만 고치기도 같은 검사를 지난다 */
  function fileOf(doc: Doc, meta: PostFile["meta"]): BuiltFile {
    const parsed = postFileSchema.safeParse({ schemaVersion: SCHEMA_VERSION, meta, doc });
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        ({ path, message }) => `- ${path.map(String).join(".")}: ${message}`,
      );
      return { ok: false, error: toolError([MCP_META_MISMATCH_MESSAGE, ...issues].join("\n")) };
    }
    return { ok: true, file: { ...parsed.data, doc: normalize(parsed.data.doc) } };
  }

  /**
   * update_draft의 새 문서 — 전체 markdown이면 다시 변환하고, 부분 고치기면 저장된 문서의 범위만 고친다
   * (범위 밖 블록은 마크다운 왕복을 타지 않아 꾸밈 · 스티커가 그대로다). 둘 다 없으면 문서는 그대로다.
   */
  function rebuild(
    saved: Doc,
    meta: PostFile["meta"],
    change: { markdown: string | undefined; edit: RangeEdit | undefined },
  ): BuiltFile {
    if (change.markdown !== undefined) return buildFile(change.markdown, meta);
    if (change.edit === undefined) return fileOf(saved, meta);
    const edited = editDocRange(saved, change.edit);
    if (!edited.ok) return { ok: false, error: toolError(edited.messages.join("\n")) };
    return fileOf(edited.doc, meta);
  }

  server.registerTool(
    "get_writing_guide",
    {
      ...MCP_TOOL_TEXT.get_writing_guide,
      annotations: READ_ONLY_TOOL,
    },
    guarded(async () => {
      const { guide } = await settings.get();
      return textResult(guide.trim() === "" ? formatGuide : withWorkspaceGuide(formatGuide, guide));
    }),
  );

  server.registerTool(
    "update_writing_guide",
    {
      ...MCP_TOOL_TEXT.update_writing_guide,
      annotations: UPDATE_GUIDE_TOOL,
      // 설정 저장(REST PUT /settings)과 같은 상한 — 넘으면 입력 오류로 저장하지 않는다
      inputSchema: z.strictObject({ guide: z.string().max(MAX_GUIDE_LENGTH) }),
    },
    guarded(async ({ guide }) => {
      if (mixesFormatGuide(guide, formatGuide)) return toolError(MCP_GUIDE_WITH_FORMAT_MESSAGE);
      // 형식 가이드는 건드리지 않는다 — 바꾸는 것은 워크스페이스 설정의 가이드뿐이고 다른 설정은 지킨다
      const current = await settings.get();
      await settings.put({ ...current, guide });
      const { guide: saved } = await settings.get();
      return textResult(saved);
    }),
  );

  server.registerTool(
    "list_posts",
    {
      ...MCP_TOOL_TEXT.list_posts,
      annotations: READ_ONLY_TOOL,
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
      annotations: READ_ONLY_TOOL,
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
    "preview_post",
    {
      ...MCP_TOOL_TEXT.preview_post,
      annotations: READ_ONLY_TOOL,
      inputSchema: z.strictObject({ slug: slugSchema, part: z.int().min(1).optional() }),
    },
    guarded(async ({ slug, part = 1 }) => {
      const found = await store.get(slug);
      if (found === null) return toolError(MCP_POST_NOT_FOUND_MESSAGE);
      const html = previewPageHtml(found.file, preview);
      const captured = await capturePreview(html, part, {
        imageBaseUrl: preview.imageBaseUrl,
        ...(preview.images === undefined ? {} : { images: preview.images }),
      });
      if (!captured.ok) {
        return toolError(
          captured.reason === "browserMissing"
            ? MCP_PREVIEW_BROWSER_MISSING_MESSAGE
            : previewPartOutOfRangeMessage(captured.parts),
        );
      }
      const { parts, images } = captured;
      const shots = [images.desktop, images.mobile].filter((image) => image !== null);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { slug, part, parts, note: previewPartNote(part, parts) },
              null,
              2,
            ),
          },
          ...shots.map((image) => ({
            type: "image" as const,
            mimeType: "image/jpeg",
            data: image.toString("base64"),
          })),
        ],
      };
    }),
  );

  server.registerTool(
    "check_draft",
    {
      ...MCP_TOOL_TEXT.check_draft,
      annotations: READ_ONLY_TOOL,
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
      return jsonResult({ ok: true, blocks: converted.doc.content.length, ...seoReport(seo) });
    }),
  );

  server.registerTool(
    "create_draft",
    {
      ...MCP_TOOL_TEXT.create_draft,
      annotations: CREATE_DRAFT_TOOL,
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
      await rememberAiSave(slug, { before: null, after: revision });
      const seo = await seoAfterSave(slug, built.file);
      return jsonResult({ slug, revision, editorUrl: editorUrlOf(slug), ...seoReport(seo) });
    }, MCP_SLUG_TAKEN_MESSAGE),
  );

  server.registerTool(
    "update_draft",
    {
      ...MCP_TOOL_TEXT.update_draft,
      annotations: UPDATE_DRAFT_TOOL,
      inputSchema: z.strictObject({
        slug: slugSchema,
        revision: z.string(),
        markdown: markdownSchema.optional(),
        edit: rangeEditSchema.optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        category: z.enum(categories).optional(),
        keyword: z.string().optional(),
      }),
    },
    guarded(async ({ slug, revision, markdown, edit, title, description, category, keyword }) => {
      // 전체(markdown) · 부분(edit) · 글 정보만 중 하나 — 둘을 함께 주면 어느 쪽이 이기는지 AI가 알 수 없다
      if (markdown !== undefined && edit !== undefined)
        return toolError(MCP_EDIT_WITH_MARKDOWN_MESSAGE);
      const hasMetaChange = [title, description, category, keyword].some(
        (value) => value !== undefined,
      );
      if (markdown === undefined && edit === undefined && !hasMetaChange) {
        return toolError(MCP_NOTHING_TO_UPDATE_MESSAGE);
      }
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
      const built = rebuild(found.file.doc, meta, { markdown, edit });
      if (!built.ok) return built.error;
      const saved = await store.put(slug, built.file, found.revision);
      await rememberAiSave(slug, { before: found.file, after: saved.revision });
      const seo = await seoAfterSave(slug, built.file);
      return jsonResult({
        slug,
        revision: saved.revision,
        editorUrl: editorUrlOf(slug),
        ...seoReport(seo),
      });
    }, MCP_CONFLICT_MESSAGE),
  );

  server.registerTool(
    "revert_draft",
    {
      ...MCP_TOOL_TEXT.revert_draft,
      annotations: REVERT_DRAFT_TOOL,
      inputSchema: z.strictObject({ slug: slugSchema }),
    },
    guarded(async ({ slug }) => {
      const reverted = await revertAiEdit(store, aiUndo, slug);
      if (!reverted.ok) return toolError(MCP_REVERT_UNAVAILABLE_MESSAGES[reverted.reason]);
      return jsonResult({ slug, revision: reverted.revision, editorUrl: editorUrlOf(slug) });
    }, MCP_REVERT_UNAVAILABLE_MESSAGES.changed),
  );

  return server;
}
