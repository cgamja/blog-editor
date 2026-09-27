import {
  countByTab,
  isAiDraft,
  lastEditedLabel,
  listDialogOf,
  postsOfTab,
  sortByLastEdited,
  tabOf,
} from "./post-list";
import type { PostSummary } from "./types";

const post = (slug: string, overrides: Partial<PostSummary> = {}): PostSummary => ({
  slug,
  title: slug,
  description: `${slug} 설명`,
  date: "2026-09-01",
  category: "parenting",
  draft: true,
  source: "editor",
  ...overrides,
});

const MIXED = [post("a"), post("b"), post("c", { draft: false })];

describe("web-post-list — 탭", () => {
  it("WHEN 초안 2편 · 발행 1편의 개수를 센다 THEN 전체 3 · 초안 2 · 발행됨 1이다", () => {
    expect(countByTab(MIXED)).toEqual({ all: 3, draft: 2, published: 1 });
  });

  it("WHEN 같은 목록을 초안 탭 · 발행됨 탭으로 거른다 THEN 초안 탭은 초안만, 발행됨 탭은 발행 글만이다", () => {
    expect(postsOfTab(MIXED, "draft").map(({ slug }) => slug)).toEqual(["a", "b"]);
    expect(postsOfTab(MIXED, "published").map(({ slug }) => slug)).toEqual(["c"]);
  });

  it("WHEN draft · published · x · 값 없음을 읽는다 THEN 초안 · 발행됨 · 전체 · 전체다", () => {
    expect([tabOf("draft"), tabOf("published"), tabOf("x"), tabOf(null)]).toEqual([
      "draft",
      "published",
      "all",
      "all",
    ]);
  });
});

describe("web-post-list — 고친 날", () => {
  it("WHEN 고친 날이 9월 3일 · 9월 21일(updated) · 9월 21일(date만)인 글을 늘어놓는다 THEN 9월 21일 두 편이 주소순으로 먼저, 9월 3일이 뒤다", () => {
    const posts = [
      post("old", { date: "2026-09-03" }),
      post("zeta", { date: "2026-09-01", updated: "2026-09-21" }),
      post("alpha", { date: "2026-09-21" }),
    ];

    expect(sortByLastEdited(posts).map(({ slug }) => slug)).toEqual(["alpha", "zeta", "old"]);
  });

  it("WHEN 2026-09-21과 2026-10-03을 표기한다 THEN 9월 21일 · 10월 3일이다", () => {
    expect([lastEditedLabel("2026-09-21"), lastEditedLabel("2026-10-03")]).toEqual([
      "9월 21일",
      "10월 3일",
    ]);
  });
});

describe("web-post-list — AI가 올린 초안", () => {
  it("WHEN claude 초안 · token 출처 초안 · editor 초안 · claude 발행 글을 판정한다 THEN 앞의 둘만 표시한다", () => {
    const judged = [
      post("a", { source: "claude" }),
      post("b", { source: "token:notion" }),
      post("c", { source: "editor" }),
      post("d", { source: "claude", draft: false }),
    ].map(isAiDraft);

    expect(judged).toEqual([true, true, false, false]);
  });
});

describe("web-post-list — 목록 대화상자", () => {
  it("WHEN import · write-ai · x · 값 없음을 읽는다 THEN 가져오기 · AI로 쓰기 · 없음 · 없음이다", () => {
    expect([
      listDialogOf("import"),
      listDialogOf("write-ai"),
      listDialogOf("x"),
      listDialogOf(null),
    ]).toEqual(["import", "write-ai", null, null]);
  });
});
