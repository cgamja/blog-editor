import { docSchema, SPACES } from "./doc";

type Json = Record<string, unknown>;

const text = (value: string): Json => ({ type: "text", text: value });
const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [text(value)],
});
const listItem = (value: string): Json => ({ type: "listItem", content: [paragraph(value)] });
const cell = (value: string): Json => ({ type: "tableCell", content: [paragraph(value)] });

/** 최상위 블록 11종 — 저마다 attrs에 space를 얹는다 */
function everyTopLevelBlock(space: string): Json[] {
  return [
    paragraph("문단", { space }),
    { type: "heading", attrs: { level: 2, space }, content: [text("제목")] },
    { type: "bulletList", attrs: { space }, content: [listItem("가")] },
    { type: "orderedList", attrs: { space }, content: [listItem("나")] },
    { type: "blockquote", attrs: { space }, content: [paragraph("인용")] },
    { type: "codeBlock", attrs: { space }, content: [text("code")] },
    { type: "horizontalRule", attrs: { space } },
    { type: "image", attrs: { src: "/images/a.webp", alt: "그림", space } },
    { type: "callout", attrs: { tone: "tip", space }, content: [paragraph("콜아웃")] },
    { type: "appScreenshot", attrs: { src: "/images/s.png", caption: "화면", space } },
    { type: "table", attrs: { space }, content: [{ type: "tableRow", content: [cell("칸")] }] },
  ];
}

describe("decoration-schema: 간격(space)", () => {
  it("WHEN 최상위 블록 11종에 space sm · lg · xl을 각각 두면 THEN 모두 통과한다", () => {
    expect(SPACES).toEqual(["sm", "lg", "xl"]);
    for (const space of SPACES) {
      const result = docSchema.safeParse({ type: "doc", content: everyTopLevelBlock(space) });
      expect(result.success, space).toBe(true);
    }
  });

  it("WHEN space가 집합 밖(md · 12px · 빈 글)이거나 안쪽 문단에 있으면 THEN 거부된다", () => {
    for (const space of ["md", "12px", ""]) {
      const result = docSchema.safeParse({ type: "doc", content: [paragraph("가", { space })] });
      expect(result.success, space).toBe(false);
    }
    const inner = docSchema.safeParse({
      type: "doc",
      content: [{ type: "blockquote", content: [paragraph("안쪽", { space: "lg" })] }],
    });
    expect(inner.success).toBe(false);
  });
});
