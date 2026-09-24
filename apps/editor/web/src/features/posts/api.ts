import { apiRequest } from "../../shared/api/http";
import {
  BOOLEAN_POST_SUMMARY_KEYS,
  POSTS_PATH,
  POST_SUMMARY_KEYS,
  POST_SUMMARY_OPTIONAL_KEYS,
} from "./constants";
import type { PostSummary } from "./types";

type FieldCheck = readonly [check: (value: unknown) => boolean, problem: string];

const STRING: FieldCheck = [(value) => typeof value === "string", "문자열이 아니다"];
const BOOLEAN: FieldCheck = [(value) => typeof value === "boolean", "불리언이 아니다"];
const OPTIONAL_STRING: FieldCheck = [
  (value) => value === undefined || typeof value === "string",
  "없거나 문자열이어야 한다",
];

// 확인할 키는 constants의 키 목록에서 만든다 — 목록이 곧 확인 대상이라 어긋날 자리가 없다.
// 목록은 api.test.ts가 계약(api/openapi.json)과 견주고, PostSummary의 모든 키를 덮는지는 constants의 타입이 본다
const FIELD_CHECKS: ReadonlyArray<readonly [string, FieldCheck]> = [
  ...POST_SUMMARY_KEYS.map(
    (key) => [key, BOOLEAN_POST_SUMMARY_KEYS.has(key) ? BOOLEAN : STRING] as const,
  ),
  ...POST_SUMMARY_OPTIONAL_KEYS.map((key) => [key, OPTIONAL_STRING] as const),
];

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
    for (const [key, [check, problem]] of FIELD_CHECKS) {
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
