import { readFileSync } from "node:fs";
import { parsePostList } from "./api";
import { POST_SUMMARY_KEYS, POST_SUMMARY_OPTIONAL_KEYS } from "./constants";

const item = (slug: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  title: slug,
  description: `${slug} 설명`,
  date: "2026-09-21",
  category: "parenting",
  draft: true,
  source: "editor",
  ...overrides,
});

interface ContractItem {
  properties: Record<string, unknown>;
  required: string[];
}

// 계약 파일이 원천 — web이 손으로 둔 목록 한 줄 키가 어긋나면 여기서 빨갛다
function contractPostListItem(): ContractItem {
  const openapi = JSON.parse(
    readFileSync(new URL("../../../../../../api/openapi.json", import.meta.url), "utf8"),
  ) as {
    components: { schemas: { PostList: { properties: { posts: { items: ContractItem } } } } };
  };
  return openapi.components.schemas.PostList.properties.posts.items;
}

describe("web-post-list — 글 목록 응답 확인", () => {
  it("WHEN 필드가 모두 맞는 두 항목의 응답을 확인한다 THEN 두 항목이다", () => {
    const posts = parsePostList({ posts: [item("a"), item("b", { updated: "2026-09-22" })] });

    expect(posts.map(({ slug }) => slug)).toEqual(["a", "b"]);
  });

  it("WHEN 두 번째 항목의 draft가 문자열인 응답을 확인한다 THEN posts[1].draft를 말하는 오류다", () => {
    expect(() => parsePostList({ posts: [item("a"), item("b", { draft: "true" })] })).toThrow(
      "posts[1].draft",
    );
  });

  it("WHEN web의 필수 · 선택 키를 계약 PostList 항목의 properties · required와 견준다 THEN 같다", () => {
    const contract = contractPostListItem();

    expect([...POST_SUMMARY_KEYS].sort()).toEqual([...contract.required].sort());
    expect([...POST_SUMMARY_KEYS, ...POST_SUMMARY_OPTIONAL_KEYS].sort()).toEqual(
      Object.keys(contract.properties).sort(),
    );
  });
});
