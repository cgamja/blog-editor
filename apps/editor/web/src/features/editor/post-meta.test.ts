import { missingForSave } from "./post-meta";

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
