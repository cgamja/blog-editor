import { fixtures } from "@blog-editor/content-schema";
import { missingForSave, withMetaPatch } from "./post-meta";

describe("web-post-meta — 저장을 막는 빈칸", () => {
  it("WHEN 제목 · 설명 · 카테고리가 비고 주소가 빈 글을 보면 THEN 제목 · 설명 · 카테고리 · 주소 순서다", () => {
    expect(missingForSave({ title: " ", description: "", category: "" }, "")).toEqual([
      "title",
      "description",
      "category",
      "slug",
    ]);
  });

  it("WHEN 네 칸을 모두 맞게 채운 글을 보면 THEN 빈 목록이다", () => {
    expect(
      missingForSave(
        { title: "수면 기록", description: "밤잠 이야기", category: "parenting" },
        "sleep-log",
      ),
    ).toEqual([]);
  });
});

describe("web-post-meta — 핵심 검색어 칸", () => {
  it("WHEN 핵심 검색어를 적었다가 공백으로 비우면 THEN 적으면 들어가고 비우면 키가 빠진다", () => {
    const meta = fixtures.minimal.meta;

    const filled = withMetaPatch(meta, { keyword: "봄 산책" });
    const cleared = withMetaPatch(filled, { keyword: "  " });

    expect(filled.keyword).toBe("봄 산책");
    expect(cleared).not.toHaveProperty("keyword");
  });
});
