import { z } from "zod";

/** 저장 형식 버전. 올릴 때는 migrations에 (v_n) => v_n+1 순수 함수를 추가한다. */
export const SCHEMA_VERSION = 1;

/** 객체 키 = slug = URL. 한 번 발행되면 잠긴다. */
export const slugSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug는 소문자·숫자·하이픈만");

/**
 * 이미지는 절대 URL이 아니라 경로만 저장한다 — 도메인은 렌더 시 imageBaseUrl로 붙인다(plan 3-8).
 * 그래서 이미지 도메인을 바꿔도 글은 그대로이고, 외부 URL·javascript: 가 들어올 자리가 없다.
 */
export const imagePathSchema = z
  .string()
  .regex(
    /^\/images\/[a-z0-9-]+\.(?:webp|png|jpg|jpeg|gif)$/,
    "이미지는 /images/<이름>.<확장자> 경로만",
  );

/** 초안이 어디서 왔는가 — 목록의 포스트잇 표시가 이 값을 쓴다(plan 3-4). */
export const POST_SOURCES = ["editor", "claude", "chatgpt"] as const;
export const postSourceSchema = z.union([
  z.enum(POST_SOURCES),
  z.string().regex(/^token:[a-z0-9-]{1,32}$/, "연결용 토큰 출처는 token:<이름>"),
]);
export type PostSource = z.infer<typeof postSourceSchema>;

/** 글 메타 길이 상한 — 가져오기 제안 · 화면의 입력 확인이 저장 규칙과 같은 값을 쓴다 */
export const TITLE_MAX_LENGTH = 80;
export const DESCRIPTION_MAX_LENGTH = 160;
/** 핵심 검색어 — 검색창에 칠 말 하나라 짧다(adr-030) */
export const KEYWORD_MAX_LENGTH = 40;

/**
 * 카테고리는 URL이 되므로 닫힌 집합이다. 목록은 사이트가 아니라 워크스페이스 설정이 준다(plan 3-3)
 * — 에디터는 특정 사이트에 묶이지 않는다. 그래서 스키마가 아니라 팩토리다.
 */
export function createPostMetaSchema(options: { categories: readonly [string, ...string[]] }) {
  return z.strictObject({
    title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
    description: z.string().trim().min(1).max(DESCRIPTION_MAX_LENGTH),
    date: z.iso.date(),
    updated: z.iso.date().optional(),
    category: z.enum(options.categories),
    draft: z.boolean(),
    image: imagePathSchema.optional(),
    source: postSourceSchema,
    /** 핵심 검색어 — SEO 검사만 쓰는 저장 전용 값이라 공개 조회 · 목록 요약에 싣지 않는다(adr-030) */
    keyword: z.string().trim().min(1).max(KEYWORD_MAX_LENGTH).optional(),
  });
}

export type PostMeta = z.infer<ReturnType<typeof createPostMetaSchema>>;
