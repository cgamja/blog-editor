import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { convertMarkdown } from "@blog-editor/content-convert";
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import { renderHtml } from "@blog-editor/content-render";
import { importPreviewRequestSchema } from "./contract/api-schemas";
import { MAX_IMPORT_BODY_BYTES } from "./input-limits";
import { IMPORT_BODY_MESSAGE, REQUEST_TOO_LARGE_MESSAGE } from "./messages";

const IMPORT_PREVIEW_PATH = "/api/import/preview";

type Block = Doc["content"][number];

function plainTextOf(block: Block): string {
  if (!("content" in block) || block.content === undefined) return "";
  return block.content
    .map((node) => ("text" in node && typeof node.text === "string" ? node.text : ""))
    .join("")
    .trim();
}

/**
 * UTF-16 길이 `max`까지 자르되 서로게이트 쌍을 가르지 않는다 — 글 메타 상한(zod `.max`)이 UTF-16 길이라
 * 코드 포인트 단위로 담을 수 있는 만큼만 담는다.
 */
function truncateTo(text: string, max: number): string {
  let result = "";
  for (const char of text) {
    if (result.length + char.length > max) break;
    result += char;
  }
  return result;
}

/** 첫 제목 블록 · 첫 문단의 글자 — 대화상자가 제목 · 설명 입력의 처음 값으로 쓴다(메타 상한까지 자른다) */
function suggestionsOf(doc: Doc): { title: string; description: string } {
  const heading = doc.content.find((block) => block.type === "heading");
  const paragraph = doc.content.find(
    (block) => block.type === "paragraph" && plainTextOf(block) !== "",
  );
  return {
    title: heading === undefined ? "" : truncateTo(plainTextOf(heading), TITLE_MAX_LENGTH),
    description:
      paragraph === undefined ? "" : truncateTo(plainTextOf(paragraph), DESCRIPTION_MAX_LENGTH),
  };
}

/**
 * `POST /api/import/preview`(import-preview-api) — web은 변환 코어에 닿지 못해(adr-009) 서버가 바꿔 준다.
 * 저장하지 않는다. 미리보기 HTML은 공개 조회와 같은 렌더러 · 이미지 주소다.
 */
export function registerImportRoutes(app: Hono, options: { imageBaseUrl: string }): void {
  app.post(
    IMPORT_PREVIEW_PATH,
    bodyLimit({
      maxSize: MAX_IMPORT_BODY_BYTES,
      onError: (c) => c.json({ message: REQUEST_TOO_LARGE_MESSAGE }, 413),
    }),
    async (c) => {
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
    },
  );
}
