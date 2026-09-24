import {
  DESCRIPTION_MAX_LENGTH,
  SCHEMA_VERSION,
  TITLE_MAX_LENGTH,
  slugSchema,
} from "@blog-editor/content-schema";
import type { Doc, PostFile } from "@blog-editor/content-schema";
import { IMPORTED_SOURCE, MARKDOWN_FILE_EXTENSIONS, MARKDOWN_FILE_MAX_BYTES } from "./constants";
import type { DraftInput, ImportPreview, MarkdownFileProblem } from "./types";

/** 미리보기로 바꾼 doc과 대화상자 입력으로 새 초안 파일을 만든다 — 저장 검증은 서버 zod가 한 번 더 한다 */
export function buildImportedPost(doc: Doc, input: DraftInput): PostFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      title: input.title.trim(),
      description: input.description.trim(),
      date: input.date,
      category: input.category,
      draft: true,
      source: IMPORTED_SOURCE,
    },
    doc,
  };
}

/** 고른 파일을 읽어도 되는가 — null이면 통과 */
export function markdownFileProblem(file: {
  name: string;
  size: number;
}): MarkdownFileProblem | null {
  const name = file.name.toLowerCase();
  if (!MARKDOWN_FILE_EXTENSIONS.some((extension) => name.endsWith(extension))) return "extension";
  if (file.size > MARKDOWN_FILE_MAX_BYTES) return "size";
  return null;
}

/** 제목이 영문이면 주소를 제안한다 — 한글 제목은 번역하지 않고 비운다(사람이 채운다) */
export function suggestSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slugSchema.safeParse(slug).success ? slug : "";
}

function hasLength(value: string, max: number): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max;
}

/** 막는 메시지 없이 변환됐고 입력이 저장 규칙에 맞을 때만 만들 수 있다 */
export function canCreateDraft(preview: ImportPreview | null, input: DraftInput): boolean {
  return (
    preview?.ok === true &&
    slugSchema.safeParse(input.slug).success &&
    hasLength(input.title, TITLE_MAX_LENGTH) &&
    hasLength(input.description, DESCRIPTION_MAX_LENGTH) &&
    input.category !== ""
  );
}
