import fc from "fast-check";
import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import { convertMarkdown, serializeMarkdown } from "./index";
import { losslessDocArbitrary } from "./serialize.arbitrary";

function paragraph(...content: Record<string, unknown>[]): Record<string, unknown> {
  return { type: "paragraph", content };
}

function text(value: string, ...marks: Record<string, unknown>[]): Record<string, unknown> {
  return marks.length > 0 ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function bulletList(...items: string[]): Record<string, unknown> {
  return {
    type: "bulletList",
    content: items.map((item) => ({ type: "listItem", content: [paragraph(text(item))] })),
  };
}

function doc(...content: Record<string, unknown>[]): Doc {
  return docSchema.parse({ type: "doc", content });
}

describe("serializeMarkdown", () => {
  it("블록마다 입력 문법 그대로 쓴다", () => {
    const input = doc(
      {
        type: "heading",
        attrs: { level: 2, font: "jua", motion: "fade-up" },
        content: [text("시작")],
      },
      paragraph(
        text("굵게", { type: "bold" }),
        text(" 그리고 "),
        text("링크", { type: "link", attrs: { href: "/blog/" } }),
      ),
      {
        type: "callout",
        attrs: { tone: "tip" },
        content: [paragraph(text("팁")), bulletList("하나")],
      },
      { type: "image", attrs: { src: "/images/a.webp", alt: "그림", width: 60 } },
      { type: "appScreenshot", attrs: { src: "/images/b.webp", caption: "화면" } },
      { type: "codeBlock", attrs: { language: "ts" }, content: [text("let a = 1")] },
      { type: "horizontalRule", attrs: { motion: "pop" } },
      {
        type: "orderedList",
        content: [{ type: "listItem", content: [paragraph(text("첫째")), bulletList("안")] }],
      },
    );

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe(
      [
        "{font=jua motion=fade-up}",
        "## 시작",
        "",
        "**굵게** 그리고 [링크](/blog/)",
        "",
        ":::callout tone=tip",
        "팁",
        "",
        "- 하나",
        ":::",
        "",
        "{width=60}",
        "![그림](/images/a.webp)",
        "",
        "{frame=app}",
        "![화면](/images/b.webp)",
        "",
        "```ts",
        "let a = 1",
        "```",
        "",
        "{motion=pop}",
        "---",
        "",
        "1. 첫째",
        "   - 안",
        "",
      ].join("\n"),
    );
    expect(result.losses).toEqual([]);
  });

  it("WHEN 원본 크기가 있는 이미지를 직렬화하고 다시 변환하면 THEN size 지시어로 나가고 같은 doc가 된다", () => {
    const input = doc({
      type: "image",
      attrs: {
        src: "/images/a.webp",
        alt: "그림",
        width: 60,
        naturalWidth: 1200,
        naturalHeight: 800,
      },
    });

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("{width=60 size=1200x800}\n![그림](/images/a.webp)\n");
    expect(result.losses).toEqual([]);
    const back = convertMarkdown(result.markdown);
    expect(back.ok && back.doc).toEqual(normalize(input));
  });

  it("WHEN 글자 스타일 · 밑줄 · 취소선 · 정렬을 직렬화하면 THEN span · ~~ · align 지시어로 나가고 되돌아온다", () => {
    const input = doc({
      type: "paragraph",
      attrs: { align: "center" },
      content: [
        text("가", { type: "textStyle", attrs: { color: "brand" } }, { type: "underline" }),
        text("나", { type: "strike" }),
      ],
    });

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("{align=center}\n[가]{color=brand underline}~~나~~\n");
    expect(result.losses).toEqual([]);
    const back = convertMarkdown(result.markdown);
    expect(back.ok && back.doc).toEqual(normalize(input));
  });

  it("WHEN 기본 모양 정렬(그림 center · 문단 left)이 든 문서를 직렬화하면 THEN align 지시어가 나가지 않는다", () => {
    const input = doc(
      { type: "image", attrs: { src: "/images/a.webp", alt: "그림", align: "center" } },
      { type: "paragraph", attrs: { align: "left" }, content: [text("가")] },
    );

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("![그림](/images/a.webp)\n\n가\n");
  });

  it("이웃한 같은 종류 목록은 표지를 바꿔 따로 남긴다", () => {
    const result = serializeMarkdown(doc(bulletList("가"), bulletList("나")));

    expect(result.markdown).toBe("- 가\n\n* 나\n");
    const back = convertMarkdown(result.markdown);
    expect(back.ok && back.doc.content.map((block) => block.type)).toEqual([
      "bulletList",
      "bulletList",
    ]);
  });

  it("WHEN `3. 가` · `4. 나`를 변환하고 다시 직렬화하면 THEN start 3 번호 목록이 되고 markdown은 `3. 가`로 시작한다", () => {
    const converted = convertMarkdown("3. 가\n4. 나\n");
    if (!converted.ok) throw new Error(JSON.stringify(converted.messages));
    expect(converted.doc.content[0]?.attrs).toEqual({ start: 3 });

    expect(serializeMarkdown(converted.doc).markdown).toBe("3. 가\n4. 나\n");
  });

  it("WHEN `1. 가` 아래 start 3 안쪽 번호 목록을 직렬화하면 THEN 항목 글과 빈 줄로 띄우고 되돌아온다", () => {
    const input = doc({
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            paragraph(text("가")),
            {
              type: "orderedList",
              attrs: { start: 3 },
              content: [{ type: "listItem", content: [paragraph(text("나"))] }],
            },
          ],
        },
      ],
    });

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("1. 가\n\n   3. 나\n");
    expect(convertMarkdown(result.markdown)).toEqual({ ok: true, doc: input, messages: [] });
  });

  it("WHEN start 3 번호 목록의 가운데 항목 첫 문단이 비면 THEN 뒤 조각은 5부터 이어서 쓴다", () => {
    const item = (value: string) => ({ type: "listItem", content: [paragraph(text(value))] });
    const input = doc({
      type: "orderedList",
      attrs: { start: 3 },
      content: [item("가"), { type: "listItem", content: [{ type: "paragraph" }] }, item("다")],
    });

    expect(serializeMarkdown(input).markdown).toBe("3. 가\n\n5) 다\n");
  });

  it("문법처럼 보이는 글자는 글자로 돌아온다", () => {
    const input = doc(
      paragraph(text("1. {a=b} *별* [x]")),
      paragraph(text(" 앞 공백")),
      paragraph(text('"인용"', { type: "bold" }), text("했다")),
    );

    const result = serializeMarkdown(input);

    expect(result.markdown.split("\n\n")).toEqual([
      "1\\. {a=b} \\*별\\* \\[x\\]",
      "&#32;앞 공백",
      '**"인용"**&#54664;다\n',
    ]);
    const back = convertMarkdown(result.markdown);
    expect(back.ok && back.doc).toEqual(normalize(input));
  });

  it("임의의 doc가 왕복해도 같다", () => {
    fc.assert(
      fc.property(losslessDocArbitrary, (input) => {
        const { markdown, losses } = serializeMarkdown(input);
        const back = convertMarkdown(markdown);

        expect(losses).toEqual([]);
        expect(back).toEqual({ ok: true, doc: normalize(input), messages: [] });
      }),
      { numRuns: 300 },
    );
  }, 30_000);

  it("참조 정의로 읽히는 코드 마크는 빠지고 목록에 남는다", () => {
    const link = { type: "link", attrs: { href: "/x" } };
    const input = doc(paragraph(text("]:", { type: "code" }, link), text("뒤")));

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("[\\]:](/x)뒤\n");
    expect(result.losses).toEqual([{ block: 1, kind: "codeMark", count: 1 }]);
    expect(convertMarkdown(result.markdown).ok).toBe(true);
  });

  it("링크 주소의 &는 글자 그대로 돌아온다", () => {
    const linked = (value: string, href: string) =>
      paragraph(text(value, { type: "link", attrs: { href } }));
    const input = doc(linked("가", "/a&amp;b"), linked("나", "/&#x2F;evil.com"));

    const back = convertMarkdown(serializeMarkdown(input).markdown);

    expect(back).toEqual({ ok: true, doc: normalize(input), messages: [] });
  });

  it("첫 문단이 빈 항목의 안쪽 목록은 한 단계 위로 올라간다", () => {
    const input = doc({
      type: "bulletList",
      content: [
        { type: "listItem", content: [paragraph(text("가"))] },
        { type: "listItem", content: [{ type: "paragraph" }, bulletList("나")] },
        { type: "listItem", content: [paragraph(text("다"))] },
      ],
    });

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("- 가\n\n* 나\n\n- 다\n");
    expect(result.losses).toEqual([{ block: 1, kind: "emptyParagraph", count: 1 }]);
    expect(convertMarkdown(result.markdown)).toEqual({
      ok: true,
      doc: doc(bulletList("가"), bulletList("나"), bulletList("다")),
      messages: [],
    });
  });

  it("스티커와 빈 문단은 빠지고 목록에 남는다", () => {
    const sticker = { id: "heart", x: 10, y: 10, size: 10, rotate: 0 };
    const input = doc(
      {
        type: "paragraph",
        attrs: { stickers: [sticker, { ...sticker, id: "cloud" }] },
        content: [text("가")],
      },
      { type: "paragraph" },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
    );

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("가\n");
    expect(result.losses).toEqual([
      { block: 1, kind: "stickers", count: 2 },
      { block: 2, kind: "emptyParagraph", count: 1 },
      { block: 3, kind: "emptyParagraph", count: 1 },
    ]);
  });

  it("WHEN 정렬 · 파이프 · 빈 칸이 있는 표를 직렬화하면 THEN GFM 표 세 줄이고 다시 변환하면 같다", () => {
    const cell = (content: Record<string, unknown>[], align?: string) => ({
      type: "tableCell",
      ...(align === undefined ? {} : { attrs: { align } }),
      content: [content.length > 0 ? paragraph(...content) : { type: "paragraph" }],
    });
    const input = doc({
      type: "table",
      content: [
        { type: "tableRow", content: [cell([text("a")]), cell([text("b")], "right")] },
        { type: "tableRow", content: [cell([text("x|y", { type: "code" })]), cell([])] },
      ],
    });

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("| a | b |\n| --- | --: |\n| `x\\|y` |  |\n");
    expect(result.losses).toEqual([]);
    expect(convertMarkdown(result.markdown)).toEqual({
      ok: true,
      doc: normalize(input),
      messages: [],
    });
  });

  it("WHEN 줄바꿈이 든 코드 마크 글자가 표 칸 · 제목에 있으면 THEN 코드 마크를 빼고 글자로 써 줄이 끊기지 않고 losses에 센다", () => {
    const code = { type: "code" };
    const input = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("a\nb", code)] },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [{ type: "tableCell", content: [paragraph(text("c\nd", code))] }],
          },
        ],
      },
    );

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe("## a&#10;b\n\n| c&#10;d |\n| --- |\n");
    expect(result.losses).toEqual([
      { block: 1, kind: "codeMark", count: 1 },
      { block: 2, kind: "codeMark", count: 1 },
    ]);
    const withoutCode = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("a\nb")] },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [{ type: "tableCell", content: [paragraph(text("c\nd"))] }],
          },
        ],
      },
    );
    expect(convertMarkdown(result.markdown)).toEqual({
      ok: true,
      doc: normalize(withoutCode),
      messages: [],
    });
  });

  it("WHEN 최상위 · 인용 · 목록 항목 문단에 hardBreak가 있으면 THEN 줄 끝 백슬래시로 쓰고 이어진 줄은 자리에 맞춰 쓴다", () => {
    const hardBreak = { type: "hardBreak" };
    const input = doc(
      paragraph(text("- 가"), hardBreak, text("# 나")),
      { type: "blockquote", content: [paragraph(text("다"), hardBreak, text("라"))] },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph(text("마"), hardBreak, text("바"))] }],
      },
    );

    const result = serializeMarkdown(input);

    expect(result.markdown).toBe(
      ["\\- 가\\", "\\# 나", "", "> 다\\", "> 라", "", "- 마\\", "  바", ""].join("\n"),
    );
    expect(result.losses).toEqual([]);
    expect(convertMarkdown(result.markdown)).toEqual({
      ok: true,
      doc: normalize(input),
      messages: [],
    });
  });

  it("WHEN 여러 줄 문단의 줄이 표 머리 줄 · 구분 줄처럼 생겼으면 THEN 다시 읽어도 표가 아니다", () => {
    const input = doc(paragraph(text("a | b"), { type: "hardBreak" }, text("| --- |")));

    const result = serializeMarkdown(input);

    expect(convertMarkdown(result.markdown)).toEqual({
      ok: true,
      doc: normalize(input),
      messages: [],
    });
  });
});
