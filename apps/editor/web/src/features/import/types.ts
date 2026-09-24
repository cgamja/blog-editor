import type { Doc } from "@blog-editor/content-schema";

/** `POST /api/import/preview` 응답(api/openapi.json `ImportPreviewResult`) */
export type ImportPreview =
  | {
      ok: true;
      doc: Doc;
      html: string;
      suggested: { title: string; description: string };
    }
  | { ok: false; messages: string[] };

/** 가져오기 대화상자에서 사람이 채우는 메타 */
export interface DraftInput {
  slug: string;
  title: string;
  description: string;
  category: string;
  /** YYYY-MM-DD */
  date: string;
}

/** 대화상자에서 사람이 고칠 수 있는 칸 — 날짜는 오늘로 정한다 */
export type EditableDraftField = "title" | "slug" | "description" | "category";
