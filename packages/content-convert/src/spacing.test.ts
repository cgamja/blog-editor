import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import { convertMarkdown, editDocRange, serializeMarkdown } from "./index";

type Json = Record<string, unknown>;

const text = (value: string): Json => ({ type: "text", text: value });
const doc = (...content: Json[]): Doc => docSchema.parse({ type: "doc", content });
const attrsAt = (value: Doc, index: number) =>
  (value.content[index] as { attrs?: Json }).attrs ?? {};

describe("markdown-directive: `{space=…}`는 블록 위 간격이다", () => {
  it("WHEN 문단 · 제목 · 이미지 · 표 · 구분선 앞에 {space=…}를 쓰면 THEN 그 블록 attrs의 space가 된다", () => {
    const markdown = [
      "{space=sm}",
      "문단",
      "",
      "{font=jua space=lg}",
      "## 제목",
      "",
      "{space=xl}",
      "![그림](/images/a.webp)",
      "",
      "{space=lg}",
      "| 이름 |",
      "| --- |",
      "| 가 |",
      "",
      "{space=sm}",
      "---",
    ].join("\n");

    const result = convertMarkdown(markdown);

    if (!result.ok) throw new Error(result.messages.join(" / "));
    expect(result.doc.content.map((block) => (block as { attrs?: Json }).attrs?.space)).toEqual([
      "sm",
      "lg",
      "xl",
      "lg",
      "sm",
    ]);
    expect(attrsAt(result.doc, 1)).toMatchObject({ font: "jua", space: "lg" });
  });

  it("WHEN {space=12px}처럼 단계 밖 값을 쓰면 THEN 실패하고 메시지가 sm · lg · xl을 알려 준다", () => {
    const result = convertMarkdown(["{space=12px}", "문단"].join("\n"));

    expect(result.ok).toBe(false);
    const message = result.ok ? "" : result.messages.join("\n");
    expect(message).toContain("12px");
    expect(message).toContain("sm · lg · xl");
  });
});

describe("markdown-serialize: 간격은 지시어 끝에 나가고 되돌아온다", () => {
  it("WHEN 글꼴 · 정렬 · 간격이 있는 문단을 직렬화하면 THEN {font=… align=… space=…}로 나가고 다시 읽으면 같다", () => {
    const input = doc({
      type: "paragraph",
      attrs: { font: "gaegu", align: "center", space: "xl" },
      content: [text("가")],
    });

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("{font=gaegu align=center space=xl}\n가\n");
    expect(result.losses).toEqual([]);
    const back = convertMarkdown(result.markdown);
    expect(back.ok && back.doc).toEqual(normalize(input));
  });
});

describe("markdown-range-edit: 부분 고치기는 블록 간격을 지킨다", () => {
  it("WHEN 간격 lg 문단 안 글자만 바꾼다 THEN 그 문단의 space가 남는다", () => {
    const input = doc(
      { type: "paragraph", content: [text("첫 문단")] },
      { type: "paragraph", attrs: { space: "lg" }, content: [text("둘째 문단이다")] },
    );

    const result = editDocRange(input, { command: "replace", selection: "둘째", markdown: "셋째" });

    if (!result.ok) throw new Error(result.messages.join(" / "));
    expect(result.doc.content[1]).toEqual({
      type: "paragraph",
      attrs: { space: "lg" },
      content: [text("셋째 문단이다")],
    });
  });
});
