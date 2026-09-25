import { createPostMetaSchema, imagePathSchema, postSourceSchema, slugSchema } from "./meta";

const schema = createPostMetaSchema({ categories: ["studio", "parenting"] });

const valid = {
  title: "첫 글",
  description: "육아비서를 만드는 이야기",
  date: "2026-09-22",
  category: "studio",
  draft: true,
  source: "editor",
};

describe("postMeta", () => {
  it("사이트 frontmatter와 같은 모양의 메타를 받는다", () => {
    expect(schema.parse(valid)).toEqual(valid);
  });

  it("워크스페이스 설정에 없는 카테고리는 거부한다 — 카테고리는 URL이라 닫힌 집합", () => {
    expect(schema.safeParse({ ...valid, category: "random" }).success).toBe(false);
  });

  it("모르는 키는 거부한다 — 모든 입구(에디터·가져오기·AI)가 같은 닫힌 집합을 지난다", () => {
    expect(schema.safeParse({ ...valid, style: "color:red" }).success).toBe(false);
  });

  it("날짜는 YYYY-MM-DD만", () => {
    expect(schema.safeParse({ ...valid, date: "2026/09/22" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, date: "2026-09-22T10:00:00Z" }).success).toBe(false);
  });

  it("WHEN keyword가 없거나 1~상한 글자면 통과하고 빈 문자열 · 상한 초과는 거부한다(post-file 핵심 검색어)", () => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, keyword: "봄 산책" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, keyword: "  " }).success).toBe(false);
    expect(schema.safeParse({ ...valid, keyword: "가".repeat(41) }).success).toBe(false);
  });

  it("빈 제목·긴 설명은 거부한다", () => {
    expect(schema.safeParse({ ...valid, title: "   " }).success).toBe(false);
    expect(schema.safeParse({ ...valid, description: "가".repeat(161) }).success).toBe(false);
  });
});

describe("imagePath — 문서에는 경로만, 도메인은 렌더 시", () => {
  it.each(["/images/a1b2c3.webp", "/images/cover-2026.png"])("허용: %s", (path) => {
    expect(imagePathSchema.safeParse(path).success).toBe(true);
  });

  it.each([
    "https://cdn.example.com/images/a.webp",
    "javascript:alert(1)",
    "/images/../secret.webp",
    "/images/a.svg",
    "images/a.webp",
  ])("거부: %s", (path) => {
    expect(imagePathSchema.safeParse(path).success).toBe(false);
  });
});

describe("postSource — 초안 출처", () => {
  it.each(["editor", "claude", "chatgpt", "token:zapier-daily"])("허용: %s", (source) => {
    expect(postSourceSchema.safeParse(source).success).toBe(true);
  });

  it.each(["gemini", "token:", "token:Has Space", "token:" + "a".repeat(33)])(
    "거부: %s",
    (source) => {
      expect(postSourceSchema.safeParse(source).success).toBe(false);
    },
  );
});

describe("slug", () => {
  it.each(["first-post", "2026-retro", "a"])("허용: %s", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each(["First-Post", "한글", "-lead", "trail-", "double--dash", ""])("거부: %s", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });
});
