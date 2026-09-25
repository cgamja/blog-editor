import fc from "fast-check";
import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import { docArbitrary } from "@blog-editor/content-schema/testing";
import { editDocRange } from "./range-edit";
import { convertMarkdown } from "./convert";
import type { RangeEditResult } from "./range-edit.types";

const HEART = { id: "heart", x: 90, y: 10, size: 12, rotate: 15 } as const;

function text(value: string, ...marks: Record<string, unknown>[]): Record<string, unknown> {
  return marks.length > 0 ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function paragraph(value: string, attrs?: Record<string, unknown>): Record<string, unknown> {
  return attrs === undefined
    ? { type: "paragraph", content: [text(value)] }
    : { type: "paragraph", attrs, content: [text(value)] };
}

function doc(...content: Record<string, unknown>[]): Doc {
  return docSchema.parse({ type: "doc", content });
}

function expectOk(
  result: RangeEditResult,
): asserts result is Extract<RangeEditResult, { ok: true }> {
  if (!result.ok) throw new Error(`실패: ${result.messages.join(" / ")}`);
}

function expectFail(
  result: RangeEditResult,
): asserts result is Extract<RangeEditResult, { ok: false }> {
  expect(result.ok).toBe(false);
}

const THREE = doc(
  paragraph("첫째 문단은 벚꽃길 이야기다."),
  paragraph("둘째 문단은 도시락 이야기다."),
  paragraph("셋째 문단은 주차 이야기다."),
);

describe("markdown-range-edit — 범위 찾기", () => {
  it("WHEN 문서에 없는 글자로 replace하면 THEN 실패이고 범위 글자와 '마크다운 기호 없이'를 알린다", () => {
    const result = editDocRange(THREE, {
      command: "replace",
      selection: "없는 글자",
      markdown: "새 글",
    });

    expectFail(result);
    const message = result.messages.join("\n");
    expect(message).toContain("없는 글자");
    expect(message).toContain("마크다운 기호 없이");
  });

  it("WHEN 두 문단에 모두 있는 글자로 replace하면 THEN 실패이고 두 블록 번호와 '더 긴 글'을 알린다", () => {
    const result = editDocRange(THREE, {
      command: "replace",
      selection: "이야기다",
      markdown: "새 글",
    });

    expectFail(result);
    const message = result.messages.join("\n");
    expect(message).toMatch(/블록 1/);
    expect(message).toMatch(/블록 2/);
    expect(message).toContain("더 긴 글");
  });
});

describe("markdown-range-edit — 한 블록 안 글자 바꾸기", () => {
  it("WHEN 글꼴 · 스티커가 있는 문단 가운데 글자를 **새 글**로 바꾸면 THEN 앞뒤 글자와 꾸밈 · 스티커가 그대로이고 가운데만 굵다", () => {
    const input = doc(
      paragraph("앞 글 바꿀 곳 뒤 글", { font: "jua", stickers: [HEART] }),
      paragraph("다른 문단"),
    );

    const result = editDocRange(input, {
      command: "replace",
      selection: "바꿀 곳",
      markdown: "**새 글**",
    });

    expectOk(result);
    expect(result.doc.content[0]).toEqual({
      type: "paragraph",
      attrs: { font: "jua", stickers: [HEART] },
      content: [text("앞 글 "), text("새 글", { type: "bold" }), text(" 뒤 글")],
    });
    expect(result.doc.content[1]).toEqual(input.content[1]);
  });

  it("WHEN 문단 안 글자를 빈 markdown으로 replace하면 THEN 그 글자만 사라진다", () => {
    const result = editDocRange(THREE, {
      command: "replace",
      selection: " 도시락",
      markdown: "",
    });

    expectOk(result);
    expect(result.doc.content[1]).toEqual(paragraph("둘째 문단은 이야기다."));
    expect(result.doc.content[0]).toEqual(THREE.content[0]);
    expect(result.doc.content[2]).toEqual(THREE.content[2]);
  });
});

describe("markdown-range-edit — 최상위 블록 바꾸기", () => {
  it("WHEN 첫째 문단 처음부터 둘째 문단 끝까지를 제목 + 문단으로 바꾸면 THEN 두 자리에 새 블록이 있고 셋째는 그대로다", () => {
    const result = editDocRange(THREE, {
      command: "replace",
      selection: "첫째...도시락 이야기다.",
      markdown: "## 새 소제목\n\n새 문단이다.",
    });

    expectOk(result);
    expect(result.doc.content).toEqual([
      { type: "heading", attrs: { level: 2 }, content: [text("새 소제목")] },
      paragraph("새 문단이다."),
      THREE.content[2],
    ]);
  });

  it("WHEN 스티커가 있는 문단 하나를 {font=jua} 문단으로 바꾸면 THEN 글꼴이 jua이고 옛 스티커를 가진다", () => {
    const input = doc(paragraph("스티커 붙은 문단", { stickers: [HEART] }), paragraph("끝"));

    const result = editDocRange(input, {
      command: "replace",
      selection: "스티커 붙은 문단",
      markdown: "{font=jua}\n다시 쓴 문단",
    });

    expectOk(result);
    expect(result.doc.content[0]).toEqual({
      type: "paragraph",
      attrs: { font: "jua", stickers: [HEART] },
      content: [text("다시 쓴 문단")],
    });
    expect(result.doc.content[1]).toEqual(input.content[1]);
  });
});

describe("markdown-range-edit — 뒤에 넣기", () => {
  it("WHEN 둘째 문단 글자로 insert_after에 새 문단을 주면 THEN 새 문단이 둘째 뒤 · 셋째 앞에 있다", () => {
    const result = editDocRange(THREE, {
      command: "insert_after",
      selection: "도시락",
      markdown: "근처 카페 이야기다.",
    });

    expectOk(result);
    expect(result.doc.content).toEqual([
      THREE.content[0],
      THREE.content[1],
      paragraph("근처 카페 이야기다."),
      THREE.content[2],
    ]);
  });
});

describe("markdown-range-edit — 범위 밖 불변", () => {
  it("WHEN 무작위 문서 뒤에 유일한 문단을 붙이고 그 문단을 replace하면 THEN 그 자리 말고 모든 최상위 블록이 정규화한 입력과 같다", () => {
    const MARKER = "범위표식ZQX";
    fc.assert(
      fc.property(docArbitrary, (random) => {
        const input = normalize(
          docSchema.parse({ ...random, content: [...random.content, paragraph(MARKER)] }),
        );
        const last = input.content.length - 1;

        const result = editDocRange(input, {
          command: "replace",
          selection: MARKER,
          markdown: "바뀐 문단",
        });

        expectOk(result);
        expect(result.doc.content.slice(0, last)).toEqual(input.content.slice(0, last));
        expect(result.doc.content[last]).toEqual(paragraph("바뀐 문단"));
      }),
      { numRuns: 60 },
    );
  });
});

describe("markdown-range-edit — 범위 모양 · 입력 오류", () => {
  it("WHEN 끝 글이 빈 '도시락...'이 글자 그대로도 없으면 THEN 실패이고 '...가 없는 부분'을 알린다", () => {
    const result = editDocRange(THREE, {
      command: "replace",
      selection: "도시락...",
      markdown: "김밥",
    });

    expectFail(result);
    expect(result.messages.join("\n")).toContain("없는 부분");
  });

  it("WHEN 문단에 '기다려...'가 글자 그대로 있고 그것을 범위로 주면 THEN 글자 그대로 찾아 바꾼다", () => {
    const input = doc(paragraph("잠깐 기다려... 그래 알았어."));

    const result = editDocRange(input, {
      command: "replace",
      selection: "기다려...",
      markdown: "멈춰",
    });

    expectOk(result);
    expect(result.doc.content[0]).toEqual(paragraph("잠깐 멈춰 그래 알았어."));
  });

  it("WHEN 형식에 맞지 않는 markdown으로 블록을 바꾸면 THEN 변환 메시지를 그대로 준다", () => {
    const result = editDocRange(THREE, {
      command: "replace",
      selection: "첫째...벚꽃길 이야기다.",
      markdown: "# 큰 제목",
    });

    expectFail(result);
    expect(result.messages).toEqual(convertMarkdown("# 큰 제목").messages);
  });

  it("WHEN insert_after에 빈 markdown을 주면 THEN 실패한다", () => {
    const result = editDocRange(THREE, {
      command: "insert_after",
      selection: "도시락",
      markdown: " ",
    });

    expectFail(result);
  });
});

describe("markdown-range-edit — 글자만 바꾸기 보강", () => {
  it("WHEN 스티커가 있는 목록의 한 항목 글자를 바꾸면 THEN 그 글자만 바뀌고 목록 꾸밈 · 다른 항목이 그대로다", () => {
    const item = (value: string) => ({ type: "listItem", content: [paragraph(value)] });
    const input = doc({
      type: "orderedList",
      attrs: { start: 3, stickers: [HEART] },
      content: [item("셋째 항목"), item("넷째 항목")],
    });

    const result = editDocRange(input, { command: "replace", selection: "넷째", markdown: "4번" });

    expectOk(result);
    expect(result.doc.content).toEqual([
      {
        type: "orderedList",
        attrs: { start: 3, stickers: [HEART] },
        content: [item("셋째 항목"), item("4번 항목")],
      },
    ]);
  });

  it("WHEN 범위가 굵은 글자 경계에 걸치면 THEN 범위 밖 굵은 글자는 굵기를 지킨다", () => {
    const bold = { type: "bold" };
    const input = doc({
      type: "paragraph",
      content: [text("앞 "), text("굵은 글", bold), text(" 뒤")],
    });

    const result = editDocRange(input, { command: "replace", selection: "앞 굵", markdown: "새" });

    expectOk(result);
    expect(result.doc.content[0]).toEqual({
      type: "paragraph",
      content: [text("새"), text("은 글", bold), text(" 뒤")],
    });
  });

  it("WHEN 코드 블록 안 글자를 펜스 없는 글로 바꾸면 THEN 그 글자만 바뀌고 언어 · 다른 줄이 그대로다", () => {
    const input = doc({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [text("const a = 1;\nconst b = 2;")],
    });

    const result = editDocRange(input, {
      command: "replace",
      selection: "a = 1",
      markdown: "a = 3",
    });

    expectOk(result);
    expect(result.doc.content[0]).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [text("const a = 3;\nconst b = 2;")],
    });
  });
});

describe("markdown-range-edit — 블록 일부만 덮는 블록 바꾸기", () => {
  it("WHEN 문단 일부를 꾸밈 줄이 붙은 글로 바꾸거나 두 문단 일부를 지우면 THEN 실패이고 '블록 일부'를 알린다", () => {
    const partialWithDirective = editDocRange(THREE, {
      command: "replace",
      selection: "벚꽃길",
      markdown: "{font=jua}\n벚꽃 터널",
    });
    const partialAcross = editDocRange(THREE, {
      command: "replace",
      selection: "벚꽃길...도시락",
      markdown: "",
    });

    expectFail(partialWithDirective);
    expectFail(partialAcross);
    expect(partialWithDirective.messages.join("\n")).toContain("블록 일부");
    expect(partialAcross.messages.join("\n")).toContain("블록 일부");
  });

  it("WHEN 목록 한 항목만 골라 꾸밈 줄이 붙은 글로 바꾸면 THEN 실패이고 입력 문서는 그대로다", () => {
    const item = (value: string) => ({ type: "listItem", content: [paragraph(value)] });
    const input = doc({ type: "bulletList", content: [item("하나"), item("둘")] });
    const before: unknown = JSON.parse(JSON.stringify(input));

    const result = editDocRange(input, {
      command: "replace",
      selection: "둘",
      markdown: "{font=jua}\n둘",
    });

    expectFail(result);
    expect(result.messages.join("\n")).toContain("블록 일부");
    expect(input).toEqual(before);
  });

  it("WHEN 앞뒤 공백이 있는 문단을 공백 뺀 글자로 골라 제목으로 바꾸면 THEN 블록 전체를 덮은 것으로 보고 바꾼다", () => {
    const input = doc(paragraph(" 앞공백 글 "), paragraph("다음"));

    const result = editDocRange(input, {
      command: "replace",
      selection: "앞공백 글",
      markdown: "## 제목",
    });

    expectOk(result);
    expect(result.doc.content).toEqual([
      { type: "heading", attrs: { level: 2 }, content: [text("제목")] },
      input.content[1],
    ]);
  });
});

describe("markdown-range-edit — 블록 지우기 · 코드 글자 지우기", () => {
  const CODE = {
    type: "codeBlock",
    attrs: { language: "ts" },
    content: [text("const a = 1;\nconst b = 2;")],
  };

  it("WHEN 문단 · 코드 블록 전체를 골라 빈 markdown으로 replace하면 THEN 그 블록이 사라진다", () => {
    const input = doc(paragraph("앞"), CODE, paragraph("뒤"));

    const paragraphGone = editDocRange(input, {
      command: "replace",
      selection: "앞",
      markdown: "",
    });
    const codeGone = editDocRange(input, {
      command: "replace",
      selection: "const a...b = 2;",
      markdown: "",
    });

    expectOk(paragraphGone);
    expectOk(codeGone);
    expect(paragraphGone.doc.content).toEqual([input.content[1], input.content[2]]);
    expect(codeGone.doc.content).toEqual([input.content[0], input.content[2]]);
  });

  it("WHEN 코드 블록의 한 줄 글자를 빈 markdown으로 replace하면 THEN 그 글자만 지워진다", () => {
    const input = doc(CODE);

    const result = editDocRange(input, {
      command: "replace",
      selection: "const b = 2;",
      markdown: "",
    });

    expectOk(result);
    expect(result.doc.content[0]).toEqual({ ...CODE, content: [text("const a = 1;\n")] });
  });
});

describe("markdown-range-edit — 범위 찾기 보강", () => {
  it("WHEN 여섯 곳에 있는 글자로 replace하면 THEN 메시지에 전체 개수 '6곳'이 있다", () => {
    const input = doc(paragraph("가 가 가 가 가 가"));

    const result = editDocRange(input, { command: "replace", selection: "가", markdown: "나" });

    expectFail(result);
    expect(result.messages.join("\n")).toContain("6곳");
  });

  it("WHEN 끝이 말줄임표 …인 글자를 범위로 주면 THEN 글자 그대로 찾아 바꾼다", () => {
    const input = doc(paragraph("잠깐… 음 그래"));

    const result = editDocRange(input, {
      command: "replace",
      selection: "잠깐…",
      markdown: "잠시",
    });

    expectOk(result);
    expect(result.doc.content[0]).toEqual(paragraph("잠시 음 그래"));
  });

  it("WHEN '...'로 나눈 범위는 두 곳이고 글자 그대로는 한 곳이면 THEN 글자 그대로 찾은 곳을 바꾼다", () => {
    const input = doc(paragraph("기다려... 그래"), paragraph("기다려 보면 그래"));

    const result = editDocRange(input, {
      command: "replace",
      selection: "기다려... 그래",
      markdown: "좋아",
    });

    expectOk(result);
    expect(result.doc.content).toEqual([paragraph("좋아"), input.content[1]]);
  });

  it("WHEN 마침표 바로 뒤에 '...'를 붙인 '첫 문단이다....끝 문단이다.'로 replace하면 THEN 첫 문단부터 끝 문단까지를 바꾼다", () => {
    const input = doc(
      paragraph("첫 문단이다."),
      paragraph("가운데 문단이다."),
      paragraph("끝 문단이다."),
      paragraph("남는 문단"),
    );

    const result = editDocRange(input, {
      command: "replace",
      selection: "첫 문단이다....끝 문단이다.",
      markdown: "하나로 합친 문단",
    });

    expectOk(result);
    expect(result.doc.content).toEqual([paragraph("하나로 합친 문단"), input.content[3]]);
  });
});

describe("markdown-range-edit — 표", () => {
  it("WHEN 표의 두 행에 걸친 일부를 골라 replace하면 THEN 실패이고 '블록 일부'와 표 전체를 고르라고 알린다", () => {
    const cell = (value: string) => ({ type: "tableCell", content: [paragraph(value)] });
    const row = (...values: string[]) => ({ type: "tableRow", content: values.map(cell) });
    const input = doc({
      type: "table",
      content: [row("이름", "나이"), row("하나", "1"), row("둘", "2")],
    });

    const result = editDocRange(input, {
      command: "replace",
      selection: "하나...둘",
      markdown: "새 문단",
    });

    expectFail(result);
    const message = result.messages.join("\n");
    expect(message).toContain("블록 일부");
    expect(message).toContain("표");
  });
});

describe("markdown-range-edit — 강제 줄바꿈이 든 문단도 범위로 고친다", () => {
  it("WHEN 첫 줄 · hardBreak · 둘째 줄 문단에서 뒤 줄만 · 줄바꿈에 걸쳐 · 줄바꿈이 든 새 글로 바꾼다 THEN 자리가 어긋나지 않고 범위 밖 줄바꿈은 남는다", () => {
    const broken = doc({
      type: "paragraph",
      content: [text("첫 줄"), { type: "hardBreak" }, text("둘째 줄")],
    });
    const paragraphOf = (result: RangeEditResult) => {
      expectOk(result);
      return result.doc.content[0];
    };

    // 뒤 줄 글자만 — 줄바꿈 뒤 자리가 한 글자 밀리지 않는다
    expect(
      paragraphOf(
        editDocRange(broken, { command: "replace", selection: "둘째", markdown: "셋째" }),
      ),
    ).toEqual({
      type: "paragraph",
      content: [text("첫 줄"), { type: "hardBreak" }, text("셋째 줄")],
    });
    // get_post 모양 그대로(`\` + 줄바꿈) 줄바꿈에 걸친 범위 — 줄바꿈도 함께 바뀐다
    expect(
      paragraphOf(
        editDocRange(broken, {
          command: "replace",
          selection: "첫 줄\\\n둘째",
          markdown: "하나",
        }),
      ),
    ).toEqual({ type: "paragraph", content: [text("하나 줄")] });
    // 새 글의 줄바꿈도 들어가고 범위 밖 줄바꿈은 남는다
    expect(
      paragraphOf(
        editDocRange(broken, { command: "replace", selection: "첫 줄", markdown: "가\\\n나" }),
      ),
    ).toEqual({
      type: "paragraph",
      content: [
        text("가"),
        { type: "hardBreak" },
        text("나"),
        { type: "hardBreak" },
        text("둘째 줄"),
      ],
    });
  });
});
