import type { Doc, PostFile } from "@blog-editor/content-schema";
import { apiRequest } from "../../shared/api/http";
import { POSTS_PATH, PREVIEW_PATH } from "./constants";
import { saveHeadersOf } from "./save-model";

const JSON_HEADERS = { "Content-Type": "application/json" };

const postPath = (slug: string) => `${POSTS_PATH}/${encodeURIComponent(slug)}`;

/** `ETag: "<revision>"`에서 revision — 저장 · 주소 바꾸기 응답도 같은 모양이다 */
function revisionOf(response: Response): string {
  const etag = response.headers.get("ETag") ?? "";
  return /^"([^"]*)"$/.exec(etag)?.[1] ?? etag;
}

export interface LoadedPost {
  file: PostFile;
  revision: string;
}

/** `GET /api/posts/{slug}` — 저장 형식과 ETag(revision) */
export async function fetchPost(slug: string): Promise<LoadedPost> {
  const response = await apiRequest(postPath(slug));
  return { file: (await response.json()) as PostFile, revision: revisionOf(response) };
}

/** 목록 요약 — 편집 화면은 카테고리 제안에만 쓴다(카테고리 목록 API는 설정 화면 #98 몫) */
export async function fetchPostCategories(): Promise<string[]> {
  const response = await apiRequest(POSTS_PATH);
  const { posts } = (await response.json()) as { posts: Array<{ category: string }> };
  return [...new Set(posts.map((post) => post.category))].sort();
}

/** `PUT /api/posts/{slug}` — revision null이면 새 글(`If-None-Match: *`). 새 revision을 돌려준다 */
export async function savePost(slug: string, file: PostFile, revision: string | null) {
  const response = await apiRequest(postPath(slug), {
    method: "PUT",
    headers: { ...JSON_HEADERS, ...saveHeadersOf(revision) },
    body: JSON.stringify(file),
  });
  return revisionOf(response);
}

/** `POST /api/posts/{slug}/rename` — 초안 주소 바꾸기. 새 주소의 revision을 돌려준다 */
export async function renamePost(from: string, to: string, revision: string) {
  const response = await apiRequest(`${postPath(from)}/rename`, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...saveHeadersOf(revision) },
    body: JSON.stringify({ to }),
  });
  return revisionOf(response);
}

/** `POST /api/preview` — 공개 렌더러가 그린 본문 HTML */
export async function fetchPreviewHtml(doc: Doc): Promise<string> {
  const response = await apiRequest(PREVIEW_PATH, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ doc }),
  });
  return ((await response.json()) as { html: string }).html;
}
