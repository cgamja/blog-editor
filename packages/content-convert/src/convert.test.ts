/// <reference types="node" />
import { readFileSync } from "node:fs";
import { docSchema, normalize } from "@blog-editor/content-schema";
import type { Block, Doc } from "@blog-editor/content-schema";
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
    ["각주", ["글[^1]", "", "[^1]: 설명"].join("\n")],
    ["할 일 목록", "- [ ] 할 일"],
    ["링크 참조 정의", ["글", "", "[r]: https://a.com"].join("\n")],
    ["목록 항목 안 두 번째 문단", ["- a", "", "  b"].join("\n")],
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
    { name: "callout이 아닌 컨테이너 이름", markdown: [":::note", "글", ":::"].join("\n") },
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

  it("WHEN size 지시어 뒤에 이미지를 쓰면 THEN 원본 크기가 된다", () => {
    const result = convertMarkdown(
      ["{frame=app size=1179x1600}", "![화면](/images/s.webp)"].join("\n"),
    );
    expectOk(result);
    expect(result.doc.content).toEqual([
      {
        type: "appScreenshot",
        attrs: {
          src: "/images/s.webp",
          caption: "화면",
          naturalWidth: 1179,
          naturalHeight: 1600,
        },
      },
    ]);
  });

  it("WHEN 상한 그대로인 size=1600x1600을 쓰면 THEN 원본 크기가 된다", () => {
    const result = convertMarkdown(["{size=1600x1600}", "![a](/images/a.webp)"].join("\n"));
    expectOk(result);
    expect(result.doc.content).toEqual([
      {
        type: "image",
        attrs: { src: "/images/a.webp", alt: "a", naturalWidth: 1600, naturalHeight: 1600 },
      },
    ]);
  });

  it.each([
    ["모양이 틀린 size=1200", ["{size=1200}", "![a](/images/a.webp)"]],
    ["범위 밖 size=0x10", ["{size=0x10}", "![a](/images/a.webp)"]],
    ["범위 밖 size=1601x10", ["{size=1601x10}", "![a](/images/a.webp)"]],
    ["앞자리 0 size=01x10", ["{size=01x10}", "![a](/images/a.webp)"]],
    ["문단의 size", ["{size=10x10}", "문단"]],
  ])("WHEN 틀린 size(%s)를 변환하면 THEN 실패하고 메시지에 size가 있다", (_name, lines) => {
    const result = convertMarkdown(lines.join("\n"));
    expectFail(result);
    expect(result.messages.join("\n")).toContain("size");
  });

  it.each([
    ["frame", ["{frame=}", "![a](/images/a.webp)"]],
    ["font", ["{font=}", "문단"]],
    ["motion", ["{motion=}", "문단"]],
    ["width", ["{width=}", "![a](/images/a.webp)"]],
    ["size", ["{size=}", "![a](/images/a.webp)"]],
  ])("WHEN 알려진 키 %s의 빈 값을 변환하면 THEN 실패하고 메시지에 그 키가 있다", (key, lines) => {
    const result = convertMarkdown(lines.join("\n"));
    expectFail(result);
    const text = result.messages.join("\n");
    expect(text).toContain(key);
    // 키 불가 · 자리 밖 같은 다른 규칙이 아니라 빈 값을 받은 값 오류여야 한다
    expect(text).toContain('(받음: "")');
  });

  it("WHEN 알 수 없는 키의 빈 값 {foo=}를 문단 앞 줄에 쓰면 THEN 성공하고 글자로 남는다", () => {
    const result = convertMarkdown(["{foo=}", "문단"].join("\n"));
    expectOk(result);
    expect(result.doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "{foo=} 문단" }] },
    ]);
  });

  it("WHEN 토큰 모양이 다른 {size=1200 x800}를 쓰면 THEN 지시어가 아니라 글자로 남는다", () => {
    const result = convertMarkdown(["{size=1200 x800}", "문단"].join("\n"));
    expectOk(result);
    expect(result.doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "{size=1200 x800} 문단" }] },
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

// ── 리뷰 재현 — 조용히 사라지거나 바뀌지 않는다 ─────────────────────────

type ParagraphNode = Extract<Block, { type: "paragraph" }>;
type CalloutNode = Extract<Block, { type: "callout" }>;
type CodeBlockNode = Extract<Block, { type: "codeBlock" }>;

describe("리뷰 재현 — 조용히 사라지거나 바뀌지 않는다", () => {
  const preservationCases: Array<{ name: string; markdown: string; check: (doc: Doc) => void }> = [
    {
      name: "링크 글자 안 code 마크가 살아남는다",
      markdown: "[`x`](https://a.com)",
      check: (doc) => {
        const paragraph = doc.content[0] as ParagraphNode | undefined;
        if (paragraph?.type !== "paragraph") throw new Error("paragraph가 아니다");
        const text = paragraph.content?.[0];
        if (text?.type !== "text") throw new Error("text가 아니다");
        expect(text.text).toBe("x");
        expect(text.marks).toEqual([
          { type: "code" },
          { type: "link", attrs: { href: "https://a.com" } },
        ]);
      },
    },
    {
      name: "쓰인 참조 링크는 인라인 링크와 같은 link 마크가 된다",
      markdown: "[글][r]\n\n[r]: https://a.com",
      check: (doc) => {
        expect(doc.content).toHaveLength(1);
        const paragraph = doc.content[0] as ParagraphNode | undefined;
        if (paragraph?.type !== "paragraph") throw new Error("paragraph가 아니다");
        const text = paragraph.content?.[0];
        if (text?.type !== "text") throw new Error("text가 아니다");
        expect(text.text).toBe("글");
        expect(text.marks).toEqual([{ type: "link", attrs: { href: "https://a.com" } }]);
      },
    },
    {
      name: "굵게 안 code 마크가 살아남는다",
      markdown: "**a `x` b**",
      check: (doc) => {
        const paragraph = doc.content[0] as ParagraphNode | undefined;
        if (paragraph?.type !== "paragraph") throw new Error("paragraph가 아니다");
        const text = paragraph.content?.[1];
        if (text?.type !== "text") throw new Error("text가 아니다");
        expect(text.text).toBe("x");
        expect(text.marks).toEqual([{ type: "bold" }, { type: "code" }]);
      },
    },
    {
      name: "frame=app 뒤 motion이 attrs에서 사라지지 않는다",
      markdown: ["{frame=app motion=fade-up width=60}", "![캡션](/images/a.png)"].join("\n"),
      check: (doc) => {
        expect(doc.content[0]).toEqual({
          type: "appScreenshot",
          attrs: { src: "/images/a.png", caption: "캡션", motion: "fade-up", width: 60 },
        });
      },
    },
    {
      name: "CRLF 지시어 줄도 다음 문단에 attrs로 붙는다",
      markdown: "{font=jua}\r\n문단\r\n",
      check: (doc) => {
        expect(doc.content).toEqual([
          { type: "paragraph", attrs: { font: "jua" }, content: [{ type: "text", text: "문단" }] },
        ]);
      },
    },
    {
      name: "BOM 뒤 지시어 줄도 다음 문단에 attrs로 붙는다",
      markdown: "﻿{font=jua}\n문단",
      check: (doc) => {
        expect(doc.content).toEqual([
          { type: "paragraph", attrs: { font: "jua" }, content: [{ type: "text", text: "문단" }] },
        ]);
      },
    },
    {
      name: "콜아웃의 CRLF 닫는 줄도 닫힘으로 인식된다",
      markdown: ":::callout\r\n글\r\n:::\r\n",
      check: (doc) => {
        const callout = doc.content[0] as CalloutNode | undefined;
        if (callout?.type !== "callout") throw new Error("callout이 아니다");
        expect(callout.attrs.tone).toBe("note");
        expect(callout.content.map((node) => node.type)).toEqual(["paragraph"]);
      },
    },
    {
      name: "정보 문자열이 있는 펜스 줄은 닫는 줄이 아니다",
      markdown: ["```", "code", "```js", "{font=jua}", "```", "```"].join("\n"),
      check: (doc) => {
        const codeBlocks = doc.content.filter(
          (node): node is CodeBlockNode => node.type === "codeBlock",
        );
        const combinedText = codeBlocks
          .flatMap((block) => block.content ?? [])
          .map((text) => text.text)
          .join("\n");
        expect(combinedText).toContain("{font=jua}");
      },
    },
    {
      name: "백틱 있는 정보 문자열은 펜스가 아니라 지시어가 살아난다",
      markdown: ["``` a`b", "{font=jua}", "문단"].join("\n"),
      check: (doc) => {
        expect(doc.content).toEqual([
          { type: "paragraph", content: [{ type: "text", text: "``` a`b" }] },
          { type: "paragraph", attrs: { font: "jua" }, content: [{ type: "text", text: "문단" }] },
        ]);
      },
    },
    {
      name: "들여쓰기 코드 블록은 지시어 모양 줄도 코드 글자로 남긴다",
      markdown: ["문단", "", "    const a = 1", "    {font=jua}"].join("\n"),
      check: (doc) => {
        const codeBlock = doc.content.find(
          (node): node is CodeBlockNode => node.type === "codeBlock",
        );
        if (!codeBlock) throw new Error("codeBlock이 없다");
        const text = (codeBlock.content ?? []).map((t) => t.text).join("");
        expect(text).toContain("{font=jua}");
        const hasFontAttr = doc.content.some((node) => {
          const attrs = (node as { attrs?: Record<string, unknown> }).attrs;
          return attrs !== undefined && "font" in attrs;
        });
        expect(hasFontAttr).toBe(false);
      },
    },
    {
      name: "이미지 alt는 라벨 원문이 아니라 보이는 글자다",
      markdown: "![*강조* a\\*b](/images/a.webp)",
      check: (doc) => {
        const image = doc.content[0];
        if (image?.type !== "image") throw new Error("image가 아니다");
        expect(image.attrs.alt).toBe("강조 a*b");
      },
    },
    {
      // alt와 다른 경로(지시어 귀속 → caption)라 따로 본다
      name: "앱 스크린샷 caption도 보이는 글자다",
      markdown: ["{frame=app}", "![**굵은** 캡션](/images/a.webp)"].join("\n"),
      check: (doc) => {
        const screenshot = doc.content[0];
        if (screenshot?.type !== "appScreenshot") throw new Error("appScreenshot이 아니다");
        expect(screenshot.attrs.caption).toBe("굵은 캡션");
      },
    },
  ];

  it.each(preservationCases)(
    "WHEN $name 이면 THEN 성공하고 내용이 그대로 남는다",
    ({ markdown, check }) => {
      const result = convertMarkdown(markdown);
      expectOk(result);
      check(result.doc);
    },
  );

  const ruleMessageRejectCases: Array<{ name: string; markdown: string }> = [
    { name: "제목 안 이미지", markdown: "## ![a](/images/a.png)" },
    {
      name: "캡션 120자 초과",
      markdown: ["{frame=app}", `![${"가".repeat(150)}](/images/a.png)`].join("\n"),
    },
    { name: "빈 링크 글자", markdown: "[](https://a.com)" },
    { name: "문단 없이 시작하는 목록 항목", markdown: "- - a" },
    { name: "인라인 각주만", markdown: "글[^1]" },
    { name: "각주 정의만", markdown: ["글", "", "[^1]: 설명"].join("\n") },
    {
      name: "인용 안의 각주",
      markdown: ["> 글[^1]", ">", "> [^1]: https://x.com"].join("\n"),
    },
    { name: "체크된 할 일 목록([x])", markdown: "- [x] 끝" },
    { name: "체크된 할 일 목록([X])", markdown: "- [X] 끝" },
    {
      name: "인라인 링크와 href를 공유하는 안 쓴 정의",
      markdown: ["[t](https://a.com)", "", "[z]: https://a.com"].join("\n"),
    },
    {
      name: "중복 라벨 정의",
      markdown: ["[t][r]", "", "[r]: https://a.com", "[r]: https://b.com"].join("\n"),
    },
    { name: "인용 표시 앞 공백 뒤 지시어", markdown: ["> 글", " > {font=jua}", "> 둘"].join("\n") },
    { name: "인용 표시 뒤 공백 둘 지시어", markdown: ["> 글", ">  {font=jua}", "> 둘"].join("\n") },
    { name: "여러 줄에 걸친 링크 title", markdown: ['[a](https://a.com "첫', '둘")'].join("\n") },
  ];

  it.each(ruleMessageRejectCases)(
    "WHEN $name 이면 THEN 조용히 성공하지 않고 규칙 메시지로 거부된다",
    ({ markdown }) => {
      const result = convertMarkdown(markdown);
      expectFail(result);
      for (const message of result.messages) {
        expect(message).not.toContain("내부 오류");
        expect(message).not.toContain("\n");
        expect(message).toMatch(/^(블록 \d+|문서) \(\d+줄\): .+\(받음: ".*"\) → .+$/);
      }
    },
  );

  const exactLineCases: Array<{ name: string; markdown: string; expectedLines: number[] }> = [
    {
      name: "title 있는 참조 링크가 쓰였다",
      markdown: ["[t][r]", "", '[r]: https://a.com "T"'].join("\n"),
      expectedLines: [3],
    },
    {
      name: "펜스 코드 뒤 인용 안의 안 쓴 정의",
      markdown: ["```", "[z]: https://q.com", "```", "", "문단", "", "> [z]: https://q.com"].join(
        "\n",
      ),
      expectedLines: [7],
    },
    {
      // 토큰 안의 줄바꿈도 줄 번호에 센다 — 받음 값도 한 줄로 접혀야 한다(ruleMessageRejectCases가 본다)
      name: "여러 줄에 걸친 인라인 HTML 뒤 태그",
      markdown: ["글 <b", 'class="x">x</b>'].join("\n"),
      expectedLines: [1, 2],
    },
  ];

  it.each(exactLineCases)(
    "WHEN $name 이면 THEN 메시지 줄 번호가 정확히 그 줄을 가리킨다",
    ({ markdown, expectedLines }) => {
      const result = convertMarkdown(markdown);
      expectFail(result);
      const lineNumbers = result.messages.map((message) => {
        const match = /\((\d+)줄\)/.exec(message);
        if (!match) throw new Error(`메시지에서 줄 번호를 못 찾았다: ${message}`);
        return Number(match[1]);
      });
      expect(lineNumbers).toEqual(expectedLines);
    },
  );

  it("WHEN 한 문단 안 서로 다른 줄에서 인라인 오류가 나면 THEN 메시지의 줄 번호가 실제 줄을 가리킨다", () => {
    const markdown = ["첫 줄", "둘째 <b>x</b>", "셋째 [x](javascript:a)"].join("\n");
    const result = convertMarkdown(markdown);
    expectFail(result);
    const lineNumbers = result.messages.map((message) => {
      const match = /\((\d+)줄\)/.exec(message);
      if (!match) throw new Error(`메시지에서 줄 번호를 못 찾았다: ${message}`);
      return Number(match[1]);
    });
    expect(lineNumbers).toEqual([2, 2, 3]);
  });
});
