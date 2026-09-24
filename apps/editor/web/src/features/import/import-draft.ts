import type { Doc, PostFile } from "@blog-editor/content-schema";
import type { DraftInput, ImportPreview } from "./types";

/** 미리보기로 바꾼 doc과 대화상자 입력으로 새 초안 파일을 만든다 */
export function buildImportedPost(doc: Doc, input: DraftInput): PostFile {
  throw new Error(`미구현: ${String(doc.type)} ${input.title}`);
}

/** 제목이 영문이면 주소를 제안한다 — 한글 제목은 번역하지 않고 비운다 */
export function suggestSlug(title: string): string {
  throw new Error(`미구현: ${title}`);
}

/** 막는 메시지 없이 변환됐고 입력이 저장 규칙에 맞을 때만 만들 수 있다 */
export function canCreateDraft(preview: ImportPreview | null, input: DraftInput): boolean {
  throw new Error(`미구현: ${String(preview)} ${input.slug}`);
}
