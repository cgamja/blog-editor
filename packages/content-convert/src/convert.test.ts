/// <reference types="node" />
import { readFileSync } from "node:fs";
import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import { convertMarkdown } from "./convert";
import type { ConvertResult } from "./convert";

function expectOk(result: ConvertResult): asserts result is Extract<ConvertResult, { ok: true }> {
  expect(result.ok).toBe(true);
}

function expectFail(
  result: ConvertResult,
): asserts result is Extract<ConvertResult, { ok: false }> {
  expect(result.ok).toBe(false);
}

/** doc 트리를 훑어 나오는 노드 type · 마크 type을 전부 모은다 — 1:1 대응 확인용. */
function collectTypesAndMarks(doc: Doc): { nodeTypes: Set<string>; markTypes: Set<string> } {
  const nodeTypes = new Set<string>();
  const markTypes = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value !== null && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.type === "string") nodeTypes.add(record.type);
      if (Array.isArray(record.marks)) {
        for (const mark of record.marks as unknown[]) {
          const markType = (mark as { type?: unknown }).type;
          if (typeof markType === "string") markTypes.add(markType);
        }
      }
      visit(record.content);
    }
  };
  visit(doc.content);
  return { nodeTypes, markTypes };
}

/**
 * 가이드의 `example` 코드 블록만 순서대로 뽑는다 — 펜스 길이가 다양해도(메인 예시는 4개, 나머지는
 * 3개) 여는/닫는 백틱 개수가 맞물려야 닫힌다(중첩된 ```ts 펜스가 4-백틱 블록을 조기에 닫지 않는다).
 */
function extractExampleBlocks(guide: string): string[] {
  const lines = guide.split("\n");
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^(`{3,})example$/.exec(lines[i]!);
    if (!open) continue;
    const fenceLength = open[1]!.length;
    let close = i + 1;
    for (; close < lines.length; close++) {
      const closeMatch = /^(`{3,})$/.exec(lines[close]!);
      if (closeMatch && closeMatch[1]!.length >= fenceLength) break;
    }
    blocks.push(lines.slice(i + 1, close).join("\n"));
    i = close;
  }
  return blocks;
}

function readGuideExamples(): string {
  const guide = readFileSync(new URL("../guide/format.md", import.meta.url), "utf8");
  return extractExampleBlocks(guide).join("\n\n");
}

// ── markdown-format ───────────────────────────────────────────────────────

describe("markdown-format", () => {
  it("WHEN 표준 문법을 전부 한 번씩 쓴 markdown을 변환하면 THEN 대응 블록 · 마크가 1:1로 나온다", () => {
    const markdown = [
      "문단 **굵게** *기울임* `코드` [링크](https://example.com)",
      "",
      "## 제목 2",
      "",
      "### 제목 3",
      "",
      "- 목록1",
      "  - 안쪽1",
      "- 목록2",
      "",
      "1. 순서1",
      "2. 순서2",
      "",
      "> 인용 문단",
      "",
      "```ts",
      "코드블록",
      "```",
      "",
      "---",
      "",
      "![대체글자](/images/a.webp)",
    ].join("\n");
    const result = convertMarkdown(markdown);
    expectOk(result);
    expect(docSchema.safeParse(result.doc).success).toBe(true);
    const { nodeTypes, markTypes } = collectTypesAndMarks(result.doc);
    for (const type of [
      "heading",
      "bulletList",
      "orderedList",
      "blockquote",
      "codeBlock",
      "horizontalRule",
      "image",
      "paragraph",
    ]) {
      expect(nodeTypes.has(type)).toBe(true);
    }
    for (const mark of ["bold", "italic", "code", "link"]) {
      expect(markTypes.has(mark)).toBe(true);
    }
  });

  it("WHEN soft break과 hard break을 각각 변환하면 THEN soft break만 받는다", () => {
    const soft = convertMarkdown(["첫 줄", "둘째 줄"].join("\n"));
    expectOk(soft);
    expect(soft.doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "첫 줄 둘째 줄" }] },
    ]);

    // 줄 끝 공백 둘(hard break) — 스키마에 자리가 없어 거부된다
    const hard = convertMarkdown(["첫 줄  ", "둘째 줄"].join("\n"));
    expectFail(hard);
    expect(hard.messages.length).toBeGreaterThan(0);
  });

  it("WHEN 순서 목록이 1부터 시작하거나 아니면 THEN 1부터만 받는다", () => {
    const startsAtOne = convertMarkdown(["1. 가", "2. 나"].join("\n"));
    expectOk(startsAtOne);
    expect(startsAtOne.doc.content[0]?.type).toBe("orderedList");

    const startsAtThree = convertMarkdown(["3. 가", "4. 나"].join("\n"));
    expectFail(startsAtThree);
    expect(startsAtThree.messages.length).toBeGreaterThan(0);
  });

  const outOfDefinitionCases: Array<[string, string]> = [
    ["h1", "# 제목"],
    ["표", ["| a | b |", "|---|---|"].join("\n")],
    ["취소선", "~~취소~~"],
    ["div", "<div>글자</div>"],
    ["br", "글자<br>"],
    ["절대 URL 이미지", "![x](https://a.com/x.png)"],
    ["인용 안의 제목", "> ## 제목"],
    ["목록 항목 안의 코드 펜스", ["- 항목", "", "  ```", "  code", "  ```"].join("\n")],
    ["javascript 링크", "[x](javascript:alert(1))"],
  ];

  it.each(outOfDefinitionCases)(
    "WHEN 정의 밖 markdown(%s)을 변환하면 THEN 거부된다",
    (_name, markdown) => {
      const result = convertMarkdown(markdown);
      expectFail(result);
      expect(result.messages.length).toBeGreaterThan(0);
    },
  );

  it("WHEN 가이드의 example 블록을 이어 붙여 변환하면 THEN 통과하고 docSchema를 통과한다", () => {
    const result = convertMarkdown(readGuideExamples());
    expectOk(result);
    expect(docSchema.safeParse(result.doc).success).toBe(true);
  });
});

// ── markdown-callout ─────────────────────────────────────────────────────

describe("markdown-callout", () => {
  it("WHEN tone 있는 · 없는 콜아웃을 변환하면 THEN callout 노드가 되고 생략하면 note다", () => {
    const withTone = convertMarkdown(
      [
        ":::callout tone=tip",
        "처음이라면 수유 기록부터 시작해 보세요.",
        "",
        "- 하루 3번이면 충분하다",
        "- 시간은 대략이면 된다",
        ":::",
      ].join("\n"),
    );
    expectOk(withTone);
    expect(docSchema.safeParse(withTone.doc).success).toBe(true);
    const callout = withTone.doc.content[0];
    if (callout?.type !== "callout") throw new Error("callout 노드가 아니다");
    expect(callout.attrs.tone).toBe("tip");
    expect(callout.content.map((node) => node.type)).toEqual(["paragraph", "bulletList"]);

    const withoutTone = convertMarkdown([":::callout", "문단", ":::"].join("\n"));
    expectOk(withoutTone);
    const defaultCallout = withoutTone.doc.content[0];
    if (defaultCallout?.type !== "callout") throw new Error("callout 노드가 아니다");
    expect(defaultCallout.attrs.tone).toBe("note");
  });

  const calloutBoundaryCases: Array<{ name: string; markdown: string; exactMessage?: string }> = [
    {
      name: "닫히지 않은 콜아웃(3줄째)",
      markdown: ["문단", "", ":::callout tone=tip", "본문"].join("\n"),
      exactMessage:
        '문서 (3줄): 콜아웃이 닫히지 않았다(받음: ":::callout tone=tip") → 끝에 ":::" 줄 추가',
    },
    {
      name: "콜아웃 안의 콜아웃",
      markdown: [":::callout", "문단", ":::callout", "내부", ":::", ":::"].join("\n"),
    },
    {
      name: "목록 항목 안의 콜아웃",
      markdown: ["- 항목", "  :::callout", "  내용", "  :::"].join("\n"),
    },
    { name: "인용 안의 콜아웃", markdown: ["> :::callout", "> 내용", "> :::"].join("\n") },
    { name: "정의 밖 tone", markdown: [":::callout tone=danger", "내용", ":::"].join("\n") },
    { name: "빈 콜아웃", markdown: [":::callout", ":::"].join("\n") },
    { name: "콜아웃 안의 제목", markdown: [":::callout", "## 제목", ":::"].join("\n") },
    {
      name: "콜아웃 안의 코드 펜스",
      markdown: [":::callout", "```ts", "code", "```", ":::"].join("\n"),
    },
  ];

  it.each(calloutBoundaryCases)(
    "WHEN 경계 오류($name)를 변환하면 THEN 거부된다",
    ({ markdown, exactMessage }) => {
      const result = convertMarkdown(markdown);
      expectFail(result);
      expect(result.messages.length).toBeGreaterThan(0);
      if (exactMessage !== undefined) expect(result.messages).toEqual([exactMessage]);
    },
  );
});

// ── markdown-directive ───────────────────────────────────────────────────

describe("markdown-directive", () => {
  it("WHEN 지시어가 다음 블록 하나를 꾸미면 THEN 그 블록 attrs만 되고 글자로 남지 않는다", () => {
    const markdown = [
      "{font=jua motion=fade-up}",
      "## 베타 테스트를 시작합니다",
      "",
      "이 문단에는 지시어가 적용되지 않는다.",
    ].join("\n");
    const result = convertMarkdown(markdown);
    expectOk(result);
    const [heading, paragraph] = result.doc.content;
    if (heading?.type !== "heading") throw new Error("heading이 아니다");
    if (paragraph?.type !== "paragraph") throw new Error("paragraph가 아니다");
    expect(heading.attrs).toEqual({ level: 2, font: "jua", motion: "fade-up" });
    expect(paragraph.attrs).toBeUndefined();
    expect(heading.content?.[0]?.text ?? "").not.toContain("{");
    expect(paragraph.content?.[0]?.text ?? "").not.toContain("{");
  });

  it("WHEN 지시어 다음 줄이 ---이면 THEN 제목이 아니라 구분선이 된다", () => {
    const result = convertMarkdown(["{motion=pop}", "---"].join("\n"));
    expectOk(result);
    expect(result.doc.content).toEqual([{ type: "horizontalRule", attrs: { motion: "pop" } }]);
  });

  it("WHEN 문단 바로 뒤에 지시어가 오면 THEN 문단을 끝내고 다음 블록에 붙는다", () => {
    const result = convertMarkdown(["첫 문단", "{motion=pop}", "---"].join("\n"));
    expectOk(result);
    expect(result.doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "첫 문단" }] },
      { type: "horizontalRule", attrs: { motion: "pop" } },
    ]);
  });

  it("WHEN 코드 펜스 안에 지시어 모양 줄을 쓰면 THEN 코드 글자로 남는다", () => {
    const result = convertMarkdown(["```", "{font=jua}", "```"].join("\n"));
    expectOk(result);
    expect(docSchema.safeParse(result.doc).success).toBe(true);
    const [block] = result.doc.content;
    if (block?.type !== "codeBlock") throw new Error("codeBlock이 아니다");
    expect(block.content).toEqual([{ type: "text", text: "{font=jua}" }]);
  });

  it("WHEN 문단 첫 줄을 \\{a=b}로 이스케이프하면 THEN 문단 글자가 되고 실패하지 않는다", () => {
    const result = convertMarkdown("\\{a=b}");
    expectOk(result);
    expect(result.doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "{a=b}" }] },
    ]);
  });

  it("WHEN {frame=app} 뒤에 이미지를 쓰면 THEN appScreenshot이 된다", () => {
    const result = convertMarkdown(
      ["{frame=app width=60}", "![오늘의 수유 기록 화면](/images/record-screen.webp)"].join("\n"),
    );
    expectOk(result);
    expect(result.doc.content).toEqual([
      {
        type: "appScreenshot",
        attrs: { src: "/images/record-screen.webp", caption: "오늘의 수유 기록 화면", width: 60 },
      },
    ]);
  });

  const directiveRejectCases: Array<{ name: string; markdown: string; exactMessage?: string }> = [
    { name: "정의 밖 키 stickers", markdown: ["{stickers=heart}", "문단"].join("\n") },
    { name: "정의 밖 키 color", markdown: ["{color=red}", "문단"].join("\n") },
    { name: "정의 밖 값 font=comic", markdown: ["{font=comic}", "문단"].join("\n") },
    { name: "정의 밖 값 width=60%", markdown: ["{width=60%}", "![a](/images/a.webp)"].join("\n") },
    {
      name: "자리 밖 - 코드 블록의 font",
      markdown: ["{font=jua}", "```", "code", "```"].join("\n"),
    },
    { name: "자리 밖 - 문단의 width", markdown: ["{width=60}", "문단"].join("\n") },
    {
      name: "문서 끝(5줄째) 지시어",
      markdown: ["문단1", "", "문단2", "", "{motion=pop}"].join("\n"),
      exactMessage:
        '문서 (5줄): 지시어 뒤에 블록이 없다(받음: "{motion=pop}") → 지시어 줄을 지우거나 바로 아래에 블록을 쓴다',
    },
    { name: "지시어 뒤 빈 줄", markdown: ["{motion=pop}", "", "문단"].join("\n") },
    { name: "목록 항목 안의 지시어", markdown: ["- 항목1", "  {font=jua}", "  항목2"].join("\n") },
    { name: "인용 안의 지시어", markdown: ["> {font=jua}", "> 내용"].join("\n") },
    {
      name: "콜아웃 안의 지시어",
      markdown: [":::callout", "{font=jua}", "내용", ":::"].join("\n"),
    },
    { name: "같은 키 중복", markdown: ["{font=jua font=gaegu}", "문단"].join("\n") },
    { name: "연속 지시어 두 줄", markdown: ["{font=jua}", "{motion=pop}", "문단"].join("\n") },
    { name: "frame=app 뒤 문단", markdown: ["{frame=app}", "문단"].join("\n") },
    {
      name: "frame 값이 app이 아님",
      markdown: ["{frame=phone}", "![a](/images/a.webp)"].join("\n"),
    },
    {
      name: "앱 스크린샷의 font",
      markdown: ["{frame=app font=jua}", "![a](/images/a.webp)"].join("\n"),
    },
  ];

  it.each(directiveRejectCases)(
    "WHEN 정의 밖 · 자리 밖 · 떨어진 지시어($name)를 변환하면 THEN 거부된다",
    ({ markdown, exactMessage }) => {
      const result = convertMarkdown(markdown);
      expectFail(result);
      expect(result.messages.length).toBeGreaterThan(0);
      if (exactMessage !== undefined) expect(result.messages).toEqual([exactMessage]);
    },
  );
});

// ── markdown-validation-message ─────────────────────────────────────────

describe("markdown-validation-message", () => {
  it("WHEN 12줄째 세 번째 블록이 # 제목이면 THEN 위치 · 규칙 · 고친 예가 담긴 메시지가 정확히 온다", () => {
    const markdown = [
      "첫 줄",
      "이어지는 줄",
      "",
      "둘째 문단 1",
      "둘째 문단 2",
      "둘째 문단 3",
      "둘째 문단 4",
      "둘째 문단 5",
      "둘째 문단 6",
      "둘째 문단 7",
      "",
      "# 제목",
    ].join("\n");
    const result = convertMarkdown(markdown);
    expectFail(result);
    expect(result.messages).toEqual([
      '블록 3 (12줄): 제목은 ##·###만 쓴다(받음: "# 제목") → "## 제목"',
    ]);
  });

  it.each(["", "   ", "\n\n\n"])(
    "WHEN 빈 문서(%j)를 변환하면 THEN 문서 형식의 메시지가 정확히 온다",
    (markdown) => {
      const result = convertMarkdown(markdown);
      expectFail(result);
      expect(result.messages).toEqual([
        '문서 (1줄): 본문이 비어 있다(받음: "") → 문단 하나 이상을 쓴다',
      ]);
    },
  );

  it("WHEN 2 · 5 · 7번 블록에 각각 오류가 있으면 THEN 메시지 3개가 그 순서대로 온다", () => {
    const markdown = [
      "문단 1",
      "",
      "{font=comic}",
      "문단 2",
      "",
      "문단 3",
      "",
      "문단 4",
      "",
      "![img](https://example.com/a.png)",
      "",
      "문단 6",
      "",
      "[링크](javascript:alert(1))",
    ].join("\n");
    const result = convertMarkdown(markdown);
    expectFail(result);
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toMatch(/^블록 2 /);
    expect(result.messages[1]).toMatch(/^블록 5 /);
    expect(result.messages[2]).toMatch(/^블록 7 /);
  });

  // markdown-format의 "가이드 example 통과" 시나리오와 입력은 같지만, 여기서는 messages가
  // 빈 배열인지(검증 응답의 모양)를 본다 — docSchema 통과 여부를 보는 앞 시나리오와 다른 실패를 잡는다.
  it("WHEN 형식 가이드의 example 블록을 이어 붙여 변환하면 THEN 메시지 목록이 빈 배열이다", () => {
    const result = convertMarkdown(readGuideExamples());
    expectOk(result);
    expect(result.messages).toEqual([]);
  });
});

// ── markdown-convert (content-convert 계약) ──────────────────────────────

describe("markdown-convert", () => {
  it("WHEN 표준 마크와 링크가 섞인 문서를 변환하면 THEN 성공 결과는 정규형 doc이다", () => {
    const markdown = ["***굵고 기울임*** 뒤", "", "`코드`와 [링크](/blog/)"].join("\n");
    const result = convertMarkdown(markdown);
    expectOk(result);
    expect(result.messages).toEqual([]);
    expect(docSchema.safeParse(result.doc).success).toBe(true);
    expect(result.doc).toEqual(normalize(result.doc));
  });

  it("WHEN # 제목 한 줄을 변환하면 THEN 실패 결과에는 doc 키가 없다", () => {
    const result = convertMarkdown("# 제목");
    expectFail(result);
    expect(result).not.toHaveProperty("doc");
    expect(result.messages).toEqual([
      '블록 1 (1줄): 제목은 ##·###만 쓴다(받음: "# 제목") → "## 제목"',
    ]);
  });
});
