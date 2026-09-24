import type { PostFile } from "@blog-editor/content-schema";
import { apiRequest } from "../../shared/api/http";
import { IMPORT_PREVIEW_PATH, POSTS_PATH } from "./constants";
import type { ImportPreview } from "./types";

/** markdown → 변환 결과(저장하지 않는다) */
export async function previewImport(
  markdown: string,
  signal?: AbortSignal,
): Promise<ImportPreview> {
  const response = await apiRequest(IMPORT_PREVIEW_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ markdown }),
    ...(signal === undefined ? {} : { signal }),
  });
  return (await response.json()) as ImportPreview;
}

/** 새 글로만 저장한다(`If-None-Match: *`) — 그 주소에 글이 있으면 409(ConflictError) */
export async function createDraft(slug: string, file: PostFile): Promise<void> {
  await apiRequest(`${POSTS_PATH}/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "content-type": "application/json", "If-None-Match": "*" },
    body: JSON.stringify(file),
  });
}
