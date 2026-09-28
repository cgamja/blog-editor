import { checkSeo, docSchema, publicDocOf } from "./index";
import type { Doc } from "./index";

const BRIEF = "잠든 아기 옆 어두운 낮잠 방";
const IMAGE_SRC = "/images/cherry-walk.webp";

function docOf(...content: unknown[]): unknown {
  return { type: "doc", content };
}

const paragraph = { type: "paragraph", content: [{ type: "text", text: "봄 산책" }] };

describe("photo-placeholder — 문서에 사진 자리 블록과 그림 설명이 있다", () => {
  it("WHEN 설명 · 비율이 있는 사진 자리, 비율 없는 사진 자리, brief가 있는 그림을 검사한다 THEN 통과한다", () => {
    const result = docSchema.safeParse(
      docOf(
        { type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "4:3" } },
        { type: "photoPlaceholder", attrs: { brief: BRIEF } },
        { type: "image", attrs: { src: IMAGE_SRC, alt: "봄 산책", brief: BRIEF } },
      ),
    );

    expect(result.success).toBe(true);
  });

  it("WHEN 빈 · 301자 · 줄바꿈 · 앞뒤 공백 설명, 비율 5:4, 움직임 있는 사진 자리, 301자 brief 그림을 검사한다 THEN 모두 거부한다", () => {
    const placeholders = [
      { brief: "" },
      { brief: "가".repeat(301) },
      { brief: "첫 줄\n둘째 줄" },
      { brief: ` ${BRIEF} ` },
      { brief: BRIEF, ratio: "5:4" },
      { brief: BRIEF, motion: "fade-up" },
    ].map((attrs) => docOf({ type: "photoPlaceholder", attrs }));
    const longBriefImage = docOf({
      type: "image",
      attrs: { src: IMAGE_SRC, alt: "봄", brief: "가".repeat(301) },
    });

    const results = [...placeholders, longBriefImage].map(
      (doc) => docSchema.safeParse(doc).success,
    );

    expect(results).toEqual([false, false, false, false, false, false, false]);
  });
});

describe("photo-placeholder — 공개용 문서에는 사진 자리와 그림 설명이 없다", () => {
  it("WHEN 문단 · 사진 자리 · brief 그림 문서에 publicDocOf를 부른다 THEN 문단 · brief 없는 그림이고 입력은 그대로다", () => {
    const doc = docSchema.parse(
      docOf(
        paragraph,
        { type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "4:3" } },
        { type: "image", attrs: { src: IMAGE_SRC, alt: "봄 산책", brief: BRIEF } },
      ),
    );
    const before = JSON.parse(JSON.stringify(doc)) as unknown;

    const result = publicDocOf(doc);

    expect(result).toEqual({
      type: "doc",
      content: [paragraph, { type: "image", attrs: { src: IMAGE_SRC, alt: "봄 산책" } }],
    });
    expect(doc).toEqual(before);
  });
});

const PROMPT = "A sleeping baby in a dim nursery, soft window light, 35mm film photo";

describe("photo-prompt — 사진 자리 · 그림은 에디터 전용 이미지 프롬프트를 가진다", () => {
  it("WHEN 1000자 프롬프트 · 1001자 프롬프트 · 줄바꿈 프롬프트의 사진 자리를 검사한다 THEN 1000자만 통과한다", () => {
    const prompts = ["a".repeat(1000), "a".repeat(1001), "first line\nsecond line"];

    const results = prompts.map(
      (prompt) =>
        docSchema.safeParse(docOf({ type: "photoPlaceholder", attrs: { brief: BRIEF, prompt } }))
          .success,
    );

    expect(results).toEqual([true, false, false]);
  });

  it("WHEN 프롬프트가 있는 사진 자리 · 프롬프트가 남은 그림 문서에 publicDocOf를 부른다 THEN 공개 문서 어디에도 프롬프트 글이 없다", () => {
    const doc = docSchema.parse(
      docOf(
        paragraph,
        { type: "photoPlaceholder", attrs: { brief: BRIEF, ratio: "4:3", prompt: PROMPT } },
        { type: "image", attrs: { src: IMAGE_SRC, alt: "봄 산책", brief: BRIEF, prompt: PROMPT } },
      ),
    );

    const result = publicDocOf(doc);

    expect(result).toEqual({
      type: "doc",
      content: [paragraph, { type: "image", attrs: { src: IMAGE_SRC, alt: "봄 산책" } }],
    });
  });
});

describe("photo-placeholder — 사진 자리가 남으면 발행 확인이 알린다", () => {
  it("WHEN 두 번째 블록이 사진 자리인 글을 checkSeo로 점검한다 THEN photo-placeholder must 발견이 블록 2를 가리킨다", () => {
    const doc = docSchema.parse(
      docOf(paragraph, { type: "photoPlaceholder", attrs: { brief: BRIEF } }),
    ) as Doc;

    const findings = checkSeo({
      slug: "spring-walk",
      meta: { title: "아이랑 봄 산책하기 좋은 서울 공원", description: "봄 산책" },
      doc,
      others: [],
    });

    expect(findings).toContainEqual(
      expect.objectContaining({
        level: "must",
        rule: "photo-placeholder",
        target: { kind: "block", block: 2 },
      }),
    );
  });
});

describe("photo-prompt — 설명 · 프롬프트는 한 줄이고 앞뒤 공백이 없다(계약 pattern과 같은 규칙)", () => {
  it("WHEN 가운데 공백 · 한 글자 · 앞 공백 · 뒤 공백 · \\r이 든 설명과 프롬프트를 검사한다 THEN 앞의 둘만 통과한다", () => {
    const values = ["a b", "a", " a", "a ", "a\rb"];

    const results = values.map((value) => [
      docSchema.safeParse(docOf({ type: "photoPlaceholder", attrs: { brief: value } })).success,
      docSchema.safeParse(
        docOf({ type: "photoPlaceholder", attrs: { brief: BRIEF, prompt: value } }),
      ).success,
    ]);

    expect(results).toEqual([
      [true, true],
      [true, true],
      [false, false],
      [false, false],
      [false, false],
    ]);
  });
});
