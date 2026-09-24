import fc from "fast-check";
import { defaultAlignOf, normalize } from "./normalize";
import { docSchema } from "./doc";
import type { Doc } from "./doc";
import { docArbitrary } from "./doc.arbitrary";

/**
 * 입력은 ProseMirror JSON 모양의 평범한 객체 리터럴이라 `type: "doc"`이 리터럴 타입으로 좁혀지지
 * 않는다 — Doc은 이 패키지가 아직 실제로 검증하지 않은 값이라 asDoc으로 캐스팅해 표현한다.
 */
function asDoc(value: unknown): Doc {
  return value as Doc;
}

describe("normalize — 검증된 문서를 정규형으로 만든다", () => {
  it("WHEN 마크 순서가 다른 두 입력을 각각 normalize하면 THEN 두 결과가 deep-equal이고 마크는 bold·italic 순서다", () => {
    const docItalicFirst = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "안녕", marks: [{ type: "italic" }, { type: "bold" }] }],
        },
      ],
    };
    const docBoldFirst = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "안녕", marks: [{ type: "bold" }, { type: "italic" }] }],
        },
      ],
    };

    const resultA = normalize(asDoc(docItalicFirst));
    const resultB = normalize(asDoc(docBoldFirst));

    expect(resultA).toEqual(resultB);
    expect(
      (resultA as unknown as { content: [{ content: [{ marks: unknown }] }] }).content[0].content[0]
        .marks,
    ).toEqual([{ type: "bold" }, { type: "italic" }]);
  });

  it("WHEN 마크가 같은 인접 텍스트가 있으면 THEN 하나로 합치고 마크가 다른 텍스트는 그대로 남긴다", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "안녕", marks: [{ type: "bold" }] },
            { type: "text", text: "하세요", marks: [{ type: "bold" }] },
            { type: "text", text: " 반가워요" },
          ],
        },
      ],
    };

    const result = normalize(asDoc(doc)) as unknown as { content: [{ content: unknown[] }] };

    expect(result.content[0].content).toEqual([
      { type: "text", text: "안녕하세요", marks: [{ type: "bold" }] },
      { type: "text", text: " 반가워요" },
    ]);
  });

  it("WHEN 인접한 두 텍스트가 모두 link 마크지만 href가 다르면 THEN 합치지 않고 그대로 남긴다", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "여기", marks: [{ type: "link", attrs: { href: "/a" } }] },
            { type: "text", text: "저기", marks: [{ type: "link", attrs: { href: "/b" } }] },
          ],
        },
      ],
    };

    const result = normalize(asDoc(doc)) as unknown as { content: [{ content: unknown[] }] };

    expect(result.content[0].content).toEqual([
      { type: "text", text: "여기", marks: [{ type: "link", attrs: { href: "/a" } }] },
      { type: "text", text: "저기", marks: [{ type: "link", attrs: { href: "/b" } }] },
    ]);
  });

  it("WHEN 키가 뒤섞인 문서를 normalize한 뒤 JSON.stringify하면 THEN type·attrs·content 순서로, attrs 안은 사전순으로 시작한다", () => {
    const doc = {
      content: [{ content: [], type: "paragraph", attrs: { motion: "pop", font: "jua" } }],
      type: "doc",
    };

    const json = JSON.stringify(normalize(asDoc(doc)));

    expect(json.startsWith('{"type":"doc"')).toBe(true);
    // rule ④ — content: [] 인 노드는 content 키 자체가 사라진다(ProseMirror toJSON과 같은 모양).
    expect(json).toContain('{"type":"paragraph","attrs":{"font":"jua","motion":"pop"}}');
  });
});

describe("normalize — 기본 모양과 같은 정렬은 지운다(adr-020)", () => {
  const image = (align: string) => ({
    type: "image",
    attrs: { src: "/images/a.webp", alt: "그림", align },
  });
  const paragraph = (align: string) => ({
    type: "paragraph",
    attrs: { align },
    content: [{ type: "text", text: "가" }],
  });

  it("WHEN 그림 align center · 문단 align left를 normalize하면 THEN 두 블록 모두 align이 없다", () => {
    const result = normalize(asDoc({ type: "doc", content: [image("center"), paragraph("left")] }));

    expect(result.content.map((block) => (block.attrs as Record<string, unknown>)?.align)).toEqual([
      undefined,
      undefined,
    ]);
    expect(result.content[1]).not.toHaveProperty("attrs");
  });

  it("WHEN 그림 align left · 문단 align center를 normalize하면 THEN 값이 그대로 남는다", () => {
    const result = normalize(asDoc({ type: "doc", content: [image("left"), paragraph("center")] }));

    expect(result.content.map((block) => (block.attrs as Record<string, unknown>)?.align)).toEqual([
      "left",
      "center",
    ]);
  });

  it("WHEN 블록 종류별 defaultAlignOf를 보면 THEN 그림 · 앱 스크린샷은 center, 문단 · 제목은 left다", () => {
    expect(["image", "appScreenshot", "paragraph", "heading"].map(defaultAlignOf)).toEqual([
      "center",
      "center",
      "left",
      "left",
    ]);
  });
});

describe("normalize — 멱등이다", () => {
  it("WHEN docSchema를 통과하는 임의 문서에 normalize를 두 번 적용하면 THEN 매번 결과가 같고 docSchema도 통과한다", () => {
    fc.assert(
      fc.property(docArbitrary, (doc) => {
        const once = normalize(doc);
        const twice = normalize(once);
        expect(twice).toEqual(once);
        expect(docSchema.safeParse(once).success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
