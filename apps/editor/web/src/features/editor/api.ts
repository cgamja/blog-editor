import type { Doc, PostFile } from "@blog-editor/content-schema";
import { apiRequest } from "../../shared/api/http";
import { POSTS_PATH, PREVIEW_PATH, postQueryKey } from "./constants";
import { saveHeadersOf } from "./save-model";
import type { LoadedPost } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

const postPath = (slug: string) => `${POSTS_PATH}/${encodeURIComponent(slug)}`;

/** `ETag: "<revision>"`에서 revision — 저장 · 주소 바꾸기 응답도 같은 모양이다 */
function revisionOf(response: Response): string {
  const etag = response.headers.get("ETag") ?? "";
  return /^"([^"]*)"$/.exec(etag)?.[1] ?? etag;
}

/** `GET /api/posts/{slug}` — 저장 형식과 ETag(revision) */
export async function fetchPost(slug: string): Promise<LoadedPost> {
  const response = await apiRequest(postPath(slug));
  return { file: (await response.json()) as PostFile, revision: revisionOf(response) };
}

/**
 * 지금 서버의 글을 새로 읽는 쿼리(「최신 글 열기」 · 「덮어쓰기」) — 캐시를 믿지 않고(staleTime 0), 편집 세션이
 * 끝나면 버린다(gcTime 0). 남겨 두면 다시 열 때 옛 revision으로 에디터를 만들어 되살리기가 충돌로 빠진다.
 */
export const latestPostQuery = (slug: string) => ({
  queryKey: postQueryKey(slug),
  queryFn: () => fetchPost(slug),
  staleTime: 0,
  gcTime: 0,
});

/** `GET /api/posts` 목록 요약 중 편집 화면이 읽는 칸만 — 글 목록 화면의 `PostSummary`(posts feature)와 다르다 */
export interface EditorPostSummary {
  slug: string;
  title: unknown;
  description: unknown;
  category: string;
}

/**
 * `GET /api/posts` — 편집 화면은 이 쿼리 하나에서 카테고리 제안과 중복 점검 대상을 `select`로 뽑는다.
 * 같은 목록을 두 쿼리로 읽으면 한쪽만 실패하는 상태가 생긴다(#166)
 */
export async function fetchPostSummaries(): Promise<EditorPostSummary[]> {
  const response = await apiRequest(POSTS_PATH);
  const { posts } = (await response.json()) as { posts: EditorPostSummary[] };
  return posts;
}

/** 카테고리 제안(카테고리 목록 API는 설정 화면 #98 몫) */
export const categoriesOf = (posts: readonly EditorPostSummary[]): string[] =>
  [...new Set(posts.map((post) => post.category))].sort();

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
