import { STICKER_IDS, STICKER_RANGES } from "@blog-editor/content-schema";
import { convertMarkdown } from "./convert";
import type { ConvertResult } from "./convert";

function expectOk(result: ConvertResult): asserts result is Extract<ConvertResult, { ok: true }> {
  if (!result.ok) throw new Error(`실패: ${result.messages.join(" / ")}`);
}

function expectFail(
  result: ConvertResult,
): asserts result is Extract<ConvertResult, { ok: false }> {
  expect(result.ok).toBe(false);
}

const TABLE = ["| a | b |", "| --- | --- |", "| 1 | 2 |"];

describe("markdown-directive — sticker= 지시어는 블록 스티커가 된다", () => {
  it("WHEN {font=jua sticker=heart@90,10,12,15 sticker=star-mint@-5,40,8} 다음 줄에 문단을 쓰면 THEN 쓴 순서대로 스티커가 되고 회전을 빼면 0이다", () => {
    const result = convertMarkdown(
      ["{font=jua sticker=heart@90,10,12,15 sticker=star-mint@-5,40,8}", "가"].join("\n"),
    );

    expectOk(result);
    expect(result.doc.content[0]).toEqual({
      type: "paragraph",
      attrs: {
        font: "jua",
        stickers: [
          { id: "heart", rotate: 15, size: 12, x: 90, y: 10 },
          { id: "star-mint", rotate: 0, size: 8, x: -5, y: 40 },
        ],
      },
      content: [{ type: "text", text: "가" }],
    });
  });

  it("WHEN 이미지 · 표 앞 지시어에 sticker=를 쓰면 THEN 이미지와 표에도 스티커가 붙는다", () => {
    const result = convertMarkdown(
      [
        "{width=60 sticker=cloud@100,0,10,0}",
        "![그림](/images/a.webp)",
        "",
        "{sticker=bottle@50,50,6,-30}",
        ...TABLE,
      ].join("\n"),
    );

    expectOk(result);
    const [image, table] = result.doc.content;
    expect(image?.attrs).toMatchObject({
      width: 60,
      stickers: [{ id: "cloud", x: 100, y: 0, size: 10, rotate: 0 }],
    });
    expect(table?.attrs).toEqual({
      stickers: [{ id: "bottle", rotate: -30, size: 6, x: 50, y: 50 }],
    });
  });

  it("WHEN 종류 · 모양 · 범위가 틀린 sticker=를 쓰면 THEN 종류 목록이나 올바른 모양 · 범위를 알려 주며 실패한다", () => {
    const messageOf = (value: string) => {
      const result = convertMarkdown([`{sticker=${value}}`, "문단"].join("\n"));
      expectFail(result);
      return result.messages.join("\n");
    };

    const unknownKind = messageOf("dog@1,2,3");
    for (const id of STICKER_IDS) expect(unknownKind).toContain(id);
    for (const value of [
      "heart@1,2",
      "heart@200,0,10",
      "heart@0,0,1",
      "heart@0,0,10,181",
      "heart@1.5,0,10",
    ]) {
      const message = messageOf(value);
      expect(message).toContain("sticker=<종류>@<x>,<y>,<크기>[,<회전>]");
      for (const range of Object.values(STICKER_RANGES)) {
        expect(message).toContain(`${range.min}~${range.max}`);
      }
    }
  });

  it("WHEN 알려진 키로 시작하는 지시어 값 안에 공백이 끼면 THEN 글자로 흘리지 않고 공백 없이 쓰라며 실패한다", () => {
    for (const line of [
      "{sticker=heart@1, 2,3}",
      "{font=jua sticker=heart@1, 2,3}",
      "{size=1200 x800}",
    ]) {
      const result = convertMarkdown([line, "문단"].join("\n"));
      expectFail(result);
      expect(result.messages.join("\n")).toContain("공백 없이");
    }
    // 고친 예는 깨진 줄의 첫 키를 따른다 — size 줄에 스티커 예를 주면 AI가 엉뚱하게 고친다
    const sizeLine = convertMarkdown(["{size=1200 x800}", "![a](/images/a.webp)"].join("\n"));
    expectFail(sizeLine);
    expect(sizeLine.messages.join("\n")).toContain("size=1200x800");
  });

  it("WHEN 문서 스티커가 12개를 넘으면 THEN 문서 메시지로 실패한다", () => {
    const stickers = (count: number) =>
      Array.from({ length: count }, (_, i) => `sticker=heart@${i},0,5`).join(" ");

    const result = convertMarkdown(
      [`{${stickers(7)}}`, "가", "", `{${stickers(6)}}`, "나"].join("\n"),
    );

    expectFail(result);
    expect(result.messages[0]).toMatch(/^문서 \(4줄\)/);
    expect(result.messages[0]).toContain("12");
  });
});
