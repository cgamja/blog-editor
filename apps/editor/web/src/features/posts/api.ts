import { apiRequest } from "../../shared/api/http";
import { POSTS_PATH } from "./constants";
import type { PostSummary } from "./types";

/**
 * 글 목록(api/openapi.json `listPosts`). 모양은 계약이 정하고 서버가 zod로 지킨다 — 여기서는 `posts` 배열인지만
 * 본다. 깨진 응답은 오류 경계로 간다. 401은 apiRequest가 세션 만료로 넘긴다.
 */
export async function fetchPosts(): Promise<PostSummary[]> {
  const body: unknown = await (await apiRequest(POSTS_PATH)).json();
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { posts?: unknown }).posts)
  ) {
    throw new Error("글 목록 응답에 posts 배열이 없다");
  }
  return (body as { posts: PostSummary[] }).posts;
}
