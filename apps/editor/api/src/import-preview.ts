import type { Hono } from "hono";
import { convertMarkdown } from "@blog-editor/content-convert";
import type { Doc } from "@blog-editor/content-schema";
import { renderHtml } from "@blog-editor/content-render";
import { importPreviewRequestSchema } from "./contract/api-schemas";
import { IMPORT_BODY_MESSAGE } from "./messages";

const IMPORT_PREVIEW_PATH = "/api/import/preview";
/** 글 메타 description 상한(content-schema meta)과 같다 — 제안이 그대로 저장 규칙을 통과하게 */
const SUGGESTED_DESCRIPTION_LENGTH = 160;

type Block = Doc["content"][number];

function plainTextOf(block: Block): string {
  if (!("content" in block) || block.content === undefined) return "";
  return block.content
    .map((node) => ("text" in node && typeof node.text === "string" ? node.text : ""))
    .join("")
    .trim();
}

/** 첫 제목 블록 · 첫 문단의 글자 — 대화상자가 제목 · 설명 입력의 처음 값으로 쓴다 */
function suggestionsOf(doc: Doc): { title: string; description: string } {
  const heading = doc.content.find((block) => block.type === "heading");
  const paragraph = doc.content.find(
    (block) => block.type === "paragraph" && plainTextOf(block) !== "",
  );
  return {
    title: heading === undefined ? "" : plainTextOf(heading),
    description:
      paragraph === undefined ? "" : plainTextOf(paragraph).slice(0, SUGGESTED_DESCRIPTION_LENGTH),
  };
}

/**
 * `POST /api/import/preview`(import-preview-api) — web은 변환 코어에 닿지 못해(adr-009) 서버가 바꿔 준다.
 * 저장하지 않는다. 미리보기 HTML은 공개 조회와 같은 렌더러 · 이미지 주소다.
 */
export function registerImportRoutes(app: Hono, options: { imageBaseUrl: string }): void {
  app.post(IMPORT_PREVIEW_PATH, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: IMPORT_BODY_MESSAGE }, 400);
    }
    const parsed = importPreviewRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ message: IMPORT_BODY_MESSAGE }, 400);

    const converted = convertMarkdown(parsed.data.markdown);
    if (!converted.ok) return c.json({ ok: false, messages: converted.messages });
    return c.json({
      ok: true,
      doc: converted.doc,
      html: renderHtml(converted, { imageBaseUrl: options.imageBaseUrl }),
      suggested: suggestionsOf(converted.doc),
    });
  });
}
