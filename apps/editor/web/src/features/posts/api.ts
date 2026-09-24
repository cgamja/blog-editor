import { apiRequest } from "../../shared/api/http";
import { POSTS_PATH } from "./constants";
import type { PostSummary } from "./types";

type FieldCheck = (value: unknown) => boolean;

const isString: FieldCheck = (value) => typeof value === "string";
const isOptionalString: FieldCheck = (value) => value === undefined || typeof value === "string";

// 키 목록은 constants의 POST_SUMMARY_KEYS와 같다 — api.test.ts가 계약(api/openapi.json)과 견준다
const FIELD_CHECKS: Readonly<Record<keyof PostSummary, readonly [FieldCheck, string]>> = {
  slug: [isString, "문자열이 아니다"],
  title: [isString, "문자열이 아니다"],
  date: [isString, "문자열이 아니다"],
  updated: [isOptionalString, "없거나 문자열이어야 한다"],
  category: [isString, "문자열이 아니다"],
  draft: [(value) => typeof value === "boolean", "불리언이 아니다"],
  source: [isString, "문자열이 아니다"],
};

/**
 * 글 목록 응답의 모양 확인(api/openapi.json `PostList`). 서버가 zod로 지키지만, 배포가 어긋나면 형 변환으로는
 * 화면 깊은 곳에서 엉뚱하게 깨진다 — 여기서 몇 번째 항목의 어느 필드인지 말하며 멈춘다(오류 경계로 간다).
 */
export function parsePostList(body: unknown): PostSummary[] {
  const posts = (body as { posts?: unknown } | null)?.posts;
  if (!Array.isArray(posts)) throw new Error("글 목록 응답에 posts 배열이 없다");
  posts.forEach((post: unknown, index) => {
    if (typeof post !== "object" || post === null) {
      throw new Error(`글 목록 응답 posts[${index}]: 객체가 아니다`);
    }
    for (const [key, [check, problem]] of Object.entries(FIELD_CHECKS)) {
      if (!check((post as Record<string, unknown>)[key])) {
        throw new Error(`글 목록 응답 posts[${index}].${key}: ${problem}`);
      }
    }
  });
  return posts as PostSummary[];
}

/** 글 목록(api/openapi.json `listPosts`). 401은 apiRequest가 세션 만료로 넘긴다. */
export async function fetchPosts(): Promise<PostSummary[]> {
  return parsePostList(await (await apiRequest(POSTS_PATH)).json());
}
