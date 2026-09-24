import { createPublicPostsResponseSchema } from "./public-api";
import { BLOG_CATEGORIES } from "./categories.test.helpers";

const schema = createPublicPostsResponseSchema({ categories: BLOG_CATEGORIES });

function post(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "beta-open",
    title: "베타 오픈",
    description: "베타 테스트를 시작합니다.",
    date: "2026-01-15",
    category: "studio",
    draft: false,
    html: '<div class="post-body"><p>본문</p></div>',
    ...overrides,
  };
}

function response(...posts: Record<string, unknown>[]): unknown {
  return { postCssUrl: "/public/post.css", posts };
}

describe("public-posts-contract", () => {
  it("WHEN 모양이 맞는 발행 글 하나를 검증하면 THEN 통과한다", () => {
    expect(schema.safeParse(response(post())).success).toBe(true);
    expect(
      schema.safeParse(response(post({ image: "https://cdn.example.com/images/a.webp" }))).success,
    ).toBe(true);
  });

  it("WHEN 저장 전용 키 · 겹치는 slug · 호스트 없는 image가 있으면 THEN 거부된다", () => {
    expect(schema.safeParse(response(post({ source: "claude" }))).success).toBe(false);
    expect(schema.safeParse(response(post({ image: "https:foo" }))).success).toBe(false);
    expect(schema.safeParse(response(post({ image: "http://a.com/x.webp" }))).success).toBe(false);
    expect(schema.safeParse(response(post(), post({ title: "다른 글" }))).success).toBe(false);
  });

  // 보호 대상 — 공개 API에 초안 없음. 고쳐서 통과시키지 않는다.
  it("WHEN 초안이 섞인 응답을 검증하면 THEN 그 글의 draft 위치에서 실패한다", () => {
    const result = schema.safeParse(response(post(), post({ slug: "secret-draft", draft: true })));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual(["posts", 1, "draft"]);
  });
});
