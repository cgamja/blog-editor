import type { Doc } from "./doc";
import { checkSeo, scoreSeo, seoOthersOf } from "./seo";
import type { SeoFinding, SeoLevel, SeoRule } from "./seo.types";

type Block = Doc["content"][number];

const TITLE = "아이랑 봄 산책하기 좋은 서울 공원 다섯 곳";
const DESCRIPTION =
  "아이와 봄 산책하기 좋은 서울 공원 다섯 곳을 골랐어요. 유모차 길, 화장실, 주차까지 한 번에 정리했어요.";
const KEYWORD = "봄 산책";

const paragraph = (text: string): Block => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const heading = (text: string): Block => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
});
const linkParagraph: Block = {
  type: "paragraph",
  content: [
    { type: "text", text: "지난 글 " },
    {
      type: "text",
      text: "봄 소풍 도시락",
      marks: [{ type: "link", attrs: { href: "/blog/spring-picnic" } }],
    },
    { type: "text", text: "도 함께 보세요." },
  ],
};
const image = (alt: string): Block => ({
  type: "image",
  attrs: { src: "/images/cherry-walk.webp", alt },
});

const FIRST = paragraph("봄 산책은 아침 9시 전이 가장 한가해요.");
const LONG_BODY = paragraph(
  "공원마다 유모차 길과 화장실 위치를 직접 걸으며 확인했어요. ".repeat(20),
);

/** 블록 순서: 1 첫 문단 · 2 소제목 · 3 긴 본문 · 4 내부 링크 문단 · 5 이미지 */
function docOf(blocks: Partial<Record<1 | 2 | 3 | 4 | 5, Block | null>> = {}): Doc {
  const base: Record<1 | 2 | 3 | 4 | 5, Block | null> = {
    1: FIRST,
    2: heading("어디로 갈까요?"),
    3: LONG_BODY,
    4: linkParagraph,
    5: image("벚꽃길을 걷는 아이 뒷모습"),
    ...blocks,
  };
  const content = ([1, 2, 3, 4, 5] as const)
    .map((key) => base[key])
    .filter((block): block is Block => block !== null);
  return { type: "doc", content: content as Doc["content"] };
}

const OTHERS = [{ slug: "spring-picnic", title: "봄 소풍 도시락", description: "도시락 이야기" }];

function input(overrides: Partial<Parameters<typeof checkSeo>[0]> = {}) {
  return {
    slug: "spring-walk",
    meta: { title: TITLE, description: DESCRIPTION, keyword: KEYWORD },
    doc: docOf(),
    others: OTHERS,
    ...overrides,
  };
}

describe("seo-check — checkSeo", () => {
  it("WHEN 모든 규칙을 통과하는 글을 검사하면 THEN 빈 목록이다", () => {
    expect(checkSeo(input())).toEqual([]);
  });

  it.each([
    ["image-alt", "must", { kind: "block", block: 5 }, input({ doc: docOf({ 5: image("  ") }) })],
    ["heading-missing", "must", { kind: "body" }, input({ doc: docOf({ 2: null }) })],
    [
      "duplicate-title",
      "must",
      { kind: "meta", field: "title" },
      input({ others: [...OTHERS, { slug: "old", title: `  ${TITLE.replace(" ", "  ")} ` }] }),
    ],
    [
      "duplicate-description",
      "must",
      { kind: "meta", field: "description" },
      input({ others: [...OTHERS, { slug: "old", title: "다른 글", description: DESCRIPTION }] }),
    ],
    [
      "title-length",
      "should",
      { kind: "meta", field: "title" },
      input({ meta: { title: "봄 산책", description: DESCRIPTION, keyword: KEYWORD } }),
    ],
    [
      "description-length",
      "should",
      { kind: "meta", field: "description" },
      input({ meta: { title: TITLE, description: "짧은 설명", keyword: KEYWORD } }),
    ],
    [
      "first-paragraph-length",
      "should",
      { kind: "block", block: 1 },
      input({
        doc: docOf({ 1: paragraph(`봄 산책 ${"길게 늘어진 첫 문단이에요. ".repeat(20)}`) }),
      }),
    ],
    [
      "keyword-in-title",
      "should",
      { kind: "meta", field: "title" },
      input({
        meta: {
          title: "아이랑 걷기 좋은 서울 공원 다섯 곳",
          description: DESCRIPTION,
          keyword: KEYWORD,
        },
      }),
    ],
    [
      "keyword-in-first-paragraph",
      "should",
      { kind: "block", block: 1 },
      input({ doc: docOf({ 1: paragraph("아침 9시 전이 가장 한가해요.") }) }),
    ],
    [
      "keyword-missing",
      "info",
      { kind: "meta", field: "keyword" },
      input({ meta: { title: TITLE, description: DESCRIPTION } }),
    ],
    ["internal-link-missing", "info", { kind: "body" }, input({ doc: docOf({ 4: null }) })],
    [
      "question-heading",
      "info",
      { kind: "block", block: 2 },
      input({ doc: docOf({ 2: heading("가 볼 만한 곳") }) }),
    ],
    [
      "body-short",
      "info",
      { kind: "body" },
      input({ doc: docOf({ 3: paragraph("짧은 본문이에요.") }) }),
    ],
  ] as const)(
    "WHEN %s만 걸리는 글을 검사하면 THEN 그 발견 하나(%s)다",
    (rule, level, target, given) => {
      const findings = checkSeo(given);

      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ rule, level, target });
      expect(findings[0]?.message).not.toBe("");
      expect(findings[0]?.fix).not.toBe("");
    },
  );

  it("WHEN alt 없는 이미지 · 짧은 제목 · 검색어 없음이 함께 있으면 THEN must → should → info 순서다", () => {
    const findings = checkSeo(
      input({
        meta: { title: "봄 산책", description: DESCRIPTION },
        doc: docOf({ 5: image("") }),
      }),
    );

    expect(findings.map((finding) => finding.rule)).toEqual([
      "image-alt",
      "title-length",
      "keyword-missing",
    ]);
  });

  it("WHEN 제목 · 설명이 NFD(자모 분리)로 와도 THEN NFC 글자 수로 세어 길이 규칙이 걸리지 않는다", () => {
    const meta = {
      title: TITLE.normalize("NFD"),
      description: DESCRIPTION.normalize("NFD"),
      keyword: KEYWORD,
    };

    expect(checkSeo(input({ meta }))).toEqual([]);
  });

  it("WHEN others에 같은 slug · 같은 제목의 글이 있으면 THEN duplicate-title이 나오지 않는다", () => {
    const findings = checkSeo(
      input({ others: [...OTHERS, { slug: "spring-walk", title: TITLE }] }),
    );

    expect(findings.map((finding) => finding.rule)).not.toContain("duplicate-title");
  });
});

describe("seo-check — 비교 대상", () => {
  it("WHEN 다른 글 목록에 자기 글만 있으면 THEN internal-link-missing이 나오지 않는다", () => {
    const findings = checkSeo(
      input({ doc: docOf({ 4: null }), others: [{ slug: "spring-walk", title: "옛 제목" }] }),
    );

    expect(findings.map((finding) => finding.rule)).not.toContain("internal-link-missing");
  });

  it("WHEN 같은 글들을 API 요약 모양 · 저장소 모양의 목록으로 seoOthersOf에 넣어 점검하면 THEN 설명 중복까지 잡혀 점수가 같다", () => {
    // web은 GET /api/posts 요약을, MCP는 저장소 목록의 메타를 넘긴다 — 제목이 문자열이 아닌 항목은 빠진다
    const apiSummaries = [
      { slug: "old", title: "다른 글", description: DESCRIPTION, draft: false },
      { slug: "broken", title: 42 },
    ];
    const storeList = [
      { slug: "old", meta: { title: "다른 글", description: DESCRIPTION, draft: false } },
      { slug: "broken", meta: { title: 42 } },
    ];
    const web = checkSeo(input({ others: seoOthersOf(apiSummaries) }));
    const mcp = checkSeo(
      input({ others: seoOthersOf(storeList.map(({ slug, meta }) => ({ slug, ...meta }))) }),
    );

    expect(web.map((finding) => finding.rule)).toContain("duplicate-description");
    expect(scoreSeo(web)).toBe(scoreSeo(mcp));
  });
});

describe("seo-check — checkSeo는 강제 줄바꿈을 글자 하나로 센다", () => {
  it("WHEN 첫 문단이 글자 100자 · hardBreak · 글자 100자면 THEN 201자로 세어 first-paragraph-length가 걸린다", () => {
    const broken: Block = {
      type: "paragraph",
      content: [
        { type: "text", text: `봄 산책${"가".repeat(96)}` },
        { type: "hardBreak" },
        { type: "text", text: "나".repeat(100) },
      ],
    };

    const rules = checkSeo(input({ doc: docOf({ 1: broken }) })).map((finding) => finding.rule);

    expect(rules).toContain("first-paragraph-length");
  });
});

describe("seo-check — scoreSeo", () => {
  const found = (rule: SeoRule, level: SeoLevel, block = 1): SeoFinding => ({
    rule,
    level,
    target: { kind: "block", block },
    message: "문제",
    fix: "고치기",
  });

  it("WHEN 발견이 없으면 THEN 100점이다", () => {
    expect(scoreSeo([])).toBe(100);
  });

  it("WHEN image-alt 두 개 · title-length · keyword-missing이면 THEN 등급별로 한 번씩 깎아 62점이다", () => {
    const findings = [
      found("image-alt", "must", 2),
      found("image-alt", "must", 5),
      found("title-length", "should"),
      found("keyword-missing", "info"),
    ];

    expect(scoreSeo(findings)).toBe(62);
  });

  it("WHEN must 네 규칙과 should 한 규칙이면 THEN 0 아래로 내려가지 않는다", () => {
    const findings = [
      found("image-alt", "must"),
      found("heading-missing", "must"),
      found("duplicate-title", "must"),
      found("duplicate-description", "must"),
      found("title-length", "should"),
    ];

    expect(scoreSeo(findings)).toBe(0);
  });
});
