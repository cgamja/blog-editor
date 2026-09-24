import { slugSchema } from "@blog-editor/content-schema";
import { suggestSlug } from "./slug";

describe("web-post-meta — 새 글 주소 제안", () => {
  it("WHEN 한글 제목을 제안하면 THEN 소리 변화 없는 로마자 slug다", () => {
    expect(suggestSlug("신생아 수면 패턴")).toBe("sinsaenga-sumyeon-paeteon");
  });

  it("WHEN 영문 · 숫자 · 기호 제목을 제안하면 THEN 소문자와 하이픈 하나씩이다", () => {
    expect(suggestSlug("Hello, World! 2026")).toBe("hello-world-2026");
  });

  it("WHEN 90자가 넘는 제목을 제안하면 THEN 80자 이하 · 하이픈으로 끝나지 않는 slug다", () => {
    const title =
      "A very long title about newborn sleep patterns across the first hundred days of life";

    const slug = suggestSlug(title);

    expect(title.length).toBeGreaterThan(80);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it("WHEN 글자가 없는 제목을 제안하면 THEN 빈 문자열이다", () => {
    expect(suggestSlug("!!! ???")).toBe("");
  });
});
