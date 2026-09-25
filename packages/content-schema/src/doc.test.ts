import { docSchema, naturalSizeOf } from "./doc";

interface CellSpec {
  text?: string;
  align?: string;
}

/** 행마다 칸 목록으로 표 블록을 만든다 — 칸 안은 문단 하나 */
function tableDoc(rows: CellSpec[][], attrs?: Record<string, unknown>) {
  return {
    type: "table",
    ...(attrs === undefined ? {} : { attrs }),
    content: rows.map((cells) => ({
      type: "tableRow",
      content: cells.map(({ text, align }) => ({
        type: "tableCell",
        ...(align === undefined ? {} : { attrs: { align } }),
        content: [
          text === undefined
            ? { type: "paragraph" }
            : { type: "paragraph", content: [{ type: "text", text }] },
        ],
      })),
    })),
  };
}

const allBlocksDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "안녕", marks: [{ type: "bold" }] },
        { type: "text", text: "취소", marks: [{ type: "strike" }] },
        { type: "text", text: "밑줄", marks: [{ type: "underline" }] },
        {
          type: "text",
          text: "스타일",
          marks: [{ type: "textStyle", attrs: { color: "brand", size: "lg" } }],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "제목", marks: [{ type: "italic" }] }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "항목1" }] }],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "순서1" }] }],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "인용 링크",
              marks: [{ type: "link", attrs: { href: "/blog/first-post" } }],
            },
            { type: "hardBreak" },
            { type: "text", text: "둘째 줄" },
          ],
        },
      ],
    },
    { type: "codeBlock", content: [{ type: "text", text: "console.log(1)" }] },
    { type: "horizontalRule" },
    { type: "image", attrs: { src: "/images/a1.webp", alt: "설명" } },
    {
      type: "callout",
      attrs: { tone: "tip" },
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "코드 강조", marks: [{ type: "code" }] }],
        },
      ],
    },
    { type: "appScreenshot", attrs: { src: "/images/shot1.webp", caption: "캡션" } },
    tableDoc([
      [{ text: "이름" }, { text: "값", align: "center" }],
      [{ text: "가" }, { text: "1" }],
    ]),
  ],
};

function minimalParagraphDoc(
  overrides: { paragraph?: Record<string, unknown>; text?: Record<string, unknown> } = {},
) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "본문", ...overrides.text }],
        ...overrides.paragraph,
      },
    ],
  };
}

function docWithHref(href: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "링크", marks: [{ type: "link", attrs: { href } }] }],
      },
    ],
  };
}

function docWithCallout(tone: unknown) {
  return {
    type: "doc",
    content: [{ type: "callout", attrs: { tone }, content: [{ type: "paragraph", content: [] }] }],
  };
}

function docWithCodeLanguage(language: string | undefined) {
  return {
    type: "doc",
    content: [
      { type: "codeBlock", attrs: language === undefined ? {} : { language }, content: [] },
    ],
  };
}

function sticker(
  overrides: Partial<{ id: string; x: number; y: number; size: number; rotate: number }> = {},
) {
  return { id: "heart", x: 0, y: 0, size: 10, rotate: 0, ...overrides };
}

function docWithStickerCounts(counts: number[]) {
  return {
    type: "doc",
    content: counts.map((count) => ({
      type: "paragraph",
      attrs: { stickers: Array.from({ length: count }, () => sticker()) },
      content: [{ type: "text", text: "블록" }],
    })),
  };
}

describe("document-schema — 1차 블록과 마크만 통과한다", () => {
  it("WHEN 모든 블록과 마크를 한 번씩 쓴 문서를 파싱하면 THEN success는 true이고 값이 그대로 보존된다", () => {
    const result = docSchema.safeParse(allBlocksDoc);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(allBlocksDoc);
  });

  it.each([
    ["정의 밖 노드 footnote", { type: "doc", content: [{ type: "footnote", content: [] }] }],
    [
      "paragraph에 attrs.style",
      { type: "doc", content: [{ type: "paragraph", attrs: { style: "color:red" }, content: [] }] },
    ],
    [
      "heading.attrs.level = 1",
      { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [] }] },
    ],
    [
      "text에 marks highlight",
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "highlight" }] }],
          },
        ],
      },
    ],
    [
      "text에 marks bold 중복",
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "bold" }, { type: "bold" }] }],
          },
        ],
      },
    ],
  ])("WHEN %s THEN success는 false다", (_label, input) => {
    expect(docSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    [
      "blockquote 안에 heading",
      {
        type: "doc",
        content: [
          { type: "blockquote", content: [{ type: "heading", attrs: { level: 2 }, content: [] }] },
        ],
      },
    ],
    [
      "codeBlock 안 텍스트에 bold 마크",
      {
        type: "doc",
        content: [
          { type: "codeBlock", content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] },
        ],
      },
    ],
    [
      "image에 content",
      {
        type: "doc",
        content: [{ type: "image", attrs: { src: "/images/a.webp", alt: "" }, content: [] }],
      },
    ],
    ["text.text가 빈 문자열", minimalParagraphDoc({ text: { text: "" } })],
  ])("WHEN 내용 규칙 위반 — %s THEN success는 false다", (_label, input) => {
    expect(docSchema.safeParse(input).success).toBe(false);
  });

  it("WHEN paragraph에 content 키가 없으면 THEN success는 true다(ProseMirror toJSON이 빈 content를 생략한다)", () => {
    const result = docSchema.safeParse({ type: "doc", content: [{ type: "paragraph" }] });
    expect(result.success).toBe(true);
  });
});

describe("document-schema — 링크 href는 허용 목록 스킴만 통과한다 (보호 대상)", () => {
  it.each([
    "https://example.com/a?b=1",
    "http://localhost:3000",
    "mailto:hi@example.com",
    "/blog/first-post",
  ])("WHEN href가 %s THEN success는 true다", (href) => {
    expect(docSchema.safeParse(docWithHref(href)).success).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,x",
    "//evil.com",
    "ftp://x",
    "https://",
    "/\\evil.com",
    "https://evil.com\u0001",
  ])("WHEN href가 %s THEN success는 false다", (href) => {
    expect(docSchema.safeParse(docWithHref(href)).success).toBe(false);
  });
});

describe("document-schema — 이미지 src는 /images/ 경로만 통과한다 (보호 대상)", () => {
  it.each([
    [
      "image.attrs.src 절대 URL",
      {
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://cdn.example.com/a.webp", alt: "" } }],
      },
    ],
    [
      "appScreenshot.attrs.src 경로 탈출",
      {
        type: "doc",
        content: [{ type: "appScreenshot", attrs: { src: "/images/../x.webp", caption: "" } }],
      },
    ],
  ])("WHEN %s THEN success는 false다", (_label, input) => {
    expect(docSchema.safeParse(input).success).toBe(false);
  });

  it("WHEN callout.tone·codeBlock.language가 닫힌 집합 밖이면 THEN 거부되고 안이면 통과한다", () => {
    expect(docSchema.safeParse(docWithCallout("danger")).success).toBe(false);
    expect(docSchema.safeParse(docWithCodeLanguage("Bash Script")).success).toBe(false);
    for (const tone of ["note", "tip", "warning"]) {
      expect(docSchema.safeParse(docWithCallout(tone)).success).toBe(true);
    }
    expect(docSchema.safeParse(docWithCodeLanguage(undefined)).success).toBe(true);
    expect(docSchema.safeParse(docWithCodeLanguage("ts")).success).toBe(true);
    expect(docSchema.safeParse(docWithCodeLanguage("c++")).success).toBe(true);
  });
});

describe("decoration-schema — 꾸미기 속성은 최상위 블록의 attrs에만, 닫힌 집합으로 들어간다", () => {
  it("WHEN 꾸미기를 최대로 쓴 문서(스티커 12개, 경계값 포함)를 파싱하면 THEN success는 true다", () => {
    const maxDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: {
            font: "jua",
            align: "center",
            stickers: [sticker({ x: -25, y: 125, size: 2, rotate: -180 })],
          },
          content: [{ type: "text", text: "문단" }],
        },
        {
          type: "heading",
          attrs: {
            level: 2,
            motion: "fade-up",
            stickers: [sticker({ x: 125, y: -25, size: 50, rotate: 180 })],
          },
          content: [{ type: "text", text: "제목" }],
        },
        {
          type: "image",
          attrs: {
            src: "/images/a1.webp",
            alt: "",
            width: 60,
            align: "right",
            stickers: Array.from({ length: 10 }, () => sticker()),
          },
        },
      ],
    };
    expect(docSchema.safeParse(maxDoc).success).toBe(true);
  });

  it.each([
    ["font: comic-sans", minimalParagraphDoc({ paragraph: { attrs: { font: "comic-sans" } } })],
    ["motion: spin", minimalParagraphDoc({ paragraph: { attrs: { motion: "spin" } } })],
    [
      "width: 24",
      {
        type: "doc",
        content: [{ type: "image", attrs: { src: "/images/a.webp", alt: "", width: 24 } }],
      },
    ],
    [
      "width: 101",
      {
        type: "doc",
        content: [{ type: "image", attrs: { src: "/images/a.webp", alt: "", width: 101 } }],
      },
    ],
    [
      "width: 50.5",
      {
        type: "doc",
        content: [{ type: "image", attrs: { src: "/images/a.webp", alt: "", width: 50.5 } }],
      },
    ],
    [
      "sticker.id: unicorn",
      minimalParagraphDoc({ paragraph: { attrs: { stickers: [sticker({ id: "unicorn" })] } } }),
    ],
    [
      "sticker.x: 126",
      minimalParagraphDoc({ paragraph: { attrs: { stickers: [sticker({ x: 126 })] } } }),
    ],
    [
      "sticker.size: 1",
      minimalParagraphDoc({ paragraph: { attrs: { stickers: [sticker({ size: 1 })] } } }),
    ],
    [
      "sticker.rotate: 181",
      minimalParagraphDoc({ paragraph: { attrs: { stickers: [sticker({ rotate: 181 })] } } }),
    ],
    ["align: justify", minimalParagraphDoc({ paragraph: { attrs: { align: "justify" } } })],
  ])("WHEN 집합·범위 밖 값 — %s THEN success는 false다", (_label, input) => {
    expect(docSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    [
      "codeBlock에 font",
      { type: "doc", content: [{ type: "codeBlock", attrs: { font: "jua" }, content: [] }] },
    ],
    ["paragraph에 width", minimalParagraphDoc({ paragraph: { attrs: { width: 60 } } })],
    [
      "bulletList에 align",
      {
        type: "doc",
        content: [
          {
            type: "bulletList",
            attrs: { align: "center" },
            content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }],
          },
        ],
      },
    ],
    [
      "listItem에 stickers",
      {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                attrs: { stickers: [sticker()] },
                content: [{ type: "paragraph", content: [] }],
              },
            ],
          },
        ],
      },
    ],
    [
      "text에 motion",
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", attrs: { motion: "fade-in" } }],
          },
        ],
      },
    ],
    [
      "callout 안 bulletList에 stickers",
      {
        type: "doc",
        content: [
          {
            type: "callout",
            attrs: { tone: "note" },
            content: [
              {
                type: "bulletList",
                attrs: { stickers: [sticker()] },
                content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }],
              },
            ],
          },
        ],
      },
    ],
    [
      "listItem에 중첩된 orderedList에 font",
      {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [] },
                  {
                    type: "orderedList",
                    attrs: { font: "jua" },
                    content: [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  ])("WHEN 허용되지 않는 자리 — %s THEN success는 false다", (_label, input) => {
    expect(docSchema.safeParse(input).success).toBe(false);
  });
});

describe("decoration-schema — 스티커는 글 하나에 최대 12개다 (보호 대상)", () => {
  it("WHEN 두 블록에 스티커 6+7=13개를 넣으면 THEN 거부되고 이슈 메시지가 상한 12를 말한다", () => {
    const result = docSchema.safeParse(docWithStickerCounts([6, 7]));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("12"))).toBe(true);
    }
  });

  it.each([
    ["한 블록에 12개", [12]],
    ["세 블록에 4개씩", [4, 4, 4]],
  ])("WHEN %s THEN success는 true다", (_label, counts) => {
    expect(docSchema.safeParse(docWithStickerCounts(counts)).success).toBe(true);
  });
});

describe("document-schema — 이미지는 원본 픽셀 크기를 선택으로 가진다", () => {
  const imageDoc = (attrs: Record<string, unknown>) => ({
    type: "doc",
    content: [{ type: "image", attrs: { src: "/images/a.webp", alt: "", ...attrs } }],
  });

  it("WHEN 크기가 있는 image와 크기 없는 appScreenshot을 파싱하면 THEN success는 true다", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "/images/a.webp",
            alt: "",
            naturalWidth: 1200,
            naturalHeight: 800,
            width: 60,
          },
        },
        { type: "appScreenshot", attrs: { src: "/images/s.webp", caption: "" } },
      ],
    };
    expect(docSchema.safeParse(doc).success).toBe(true);
  });

  it.each([
    ["naturalWidth만", imageDoc({ naturalWidth: 1200 })],
    ["naturalWidth: 0", imageDoc({ naturalWidth: 0, naturalHeight: 800 })],
    ["naturalHeight: 1601", imageDoc({ naturalWidth: 1200, naturalHeight: 1601 })],
    ["naturalWidth: 10.5", imageDoc({ naturalWidth: 10.5, naturalHeight: 800 })],
  ])("WHEN %s THEN success는 false다", (_label, input) => {
    expect(docSchema.safeParse(input).success).toBe(false);
  });

  it("WHEN 짝 · 빈 attrs · 한쪽만을 naturalSizeOf에 넣으면 THEN 짝일 때만 크기이고 나머지는 null이다", () => {
    expect([
      naturalSizeOf({ naturalWidth: 1200, naturalHeight: 800 }),
      naturalSizeOf({}),
      naturalSizeOf({ naturalWidth: 1200 }),
    ]).toEqual([{ width: 1200, height: 800 }, null, null]);
  });
});

function docWithTextStyle(attrs: unknown) {
  return minimalParagraphDoc({ text: { marks: [{ type: "textStyle", attrs }] } });
}

describe("decoration-schema — 글자 스타일 마크는 이름 붙은 값과 hex만 받는다", () => {
  it.each([
    ["프리셋 색 + 크기", { color: "brand", size: "lg" }],
    ["hex 배경", { highlight: "#ffeecc" }],
    ["Gaegu light", { font: "gaegu", weight: "light" }],
    ["글꼴 없이 heavy(Pretendard 기준)", { weight: "heavy" }],
  ])("WHEN textStyle %s THEN success는 true다", (_label, attrs) => {
    expect(docSchema.safeParse(docWithTextStyle(attrs)).success).toBe(true);
  });

  it.each([
    ["빈 스타일", {}],
    ["대문자 · 3자리 hex", { color: "#FFF" }],
    ["CSS 주입 시도", { color: "red; background:url(x)" }],
    ["정의 밖 크기", { size: "3xl" }],
    ["Jua에 없는 두께", { font: "jua", weight: "light" }],
    ["정의 밖 키", { style: "color:red" }],
  ])("WHEN textStyle %s THEN success는 false다", (_label, attrs) => {
    expect(docSchema.safeParse(docWithTextStyle(attrs)).success).toBe(false);
  });
});

function orderedListWith(start: unknown, nestedStart?: unknown) {
  const item = (label: string, ...nested: Record<string, unknown>[]) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text: label }] }, ...nested],
  });
  const nested =
    nestedStart === undefined
      ? []
      : [{ type: "orderedList", attrs: { start: nestedStart }, content: [item("안")] }];
  return {
    type: "doc",
    content: [{ type: "orderedList", attrs: { start }, content: [item("가", ...nested)] }],
  };
}

describe("ordered-list-start — 번호 목록은 시작 번호를 선택으로 가진다", () => {
  it("WHEN 최상위 번호 목록 start 3과 목록 항목 안 번호 목록 start 2를 검증하면 THEN 통과한다", () => {
    expect(docSchema.safeParse(orderedListWith(3, 2)).success).toBe(true);
  });

  it.each([0, -1, 1.5, "3", 1_000_000_000])("WHEN start %s를 검증하면 THEN 거부된다", (start) => {
    expect(docSchema.safeParse(orderedListWith(start)).success).toBe(false);
  });
});

describe("document-schema — 표는 직사각형이고 첫 행이 머리 행이다", () => {
  it("WHEN 머리 행에 정렬이 있는 2×2 표를 파싱하면 THEN success는 true다", () => {
    const doc = {
      type: "doc",
      content: [
        tableDoc([
          [{ text: "이름" }, { text: "값", align: "center" }],
          [{ text: "가" }, {}],
        ]),
      ],
    };
    expect(docSchema.safeParse(doc).success).toBe(true);
  });

  const twoParagraphCell = {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [
          {
            type: "tableCell",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "가" }] },
              { type: "paragraph", content: [{ type: "text", text: "나" }] },
            ],
          },
        ],
      },
    ],
  };
  it.each([
    ["행마다 칸 수가 다른 표", tableDoc([[{ text: "a" }, { text: "b" }], [{ text: "c" }]])],
    ["둘째 행 칸에 align이 있는 표", tableDoc([[{ text: "a" }], [{ text: "b", align: "right" }]])],
    ["칸에 문단이 둘인 표", twoParagraphCell],
    ["인용 안의 표", { type: "blockquote", content: [tableDoc([[{ text: "a" }]])] }],
  ])("WHEN %s를 파싱하면 THEN success는 false다", (_label, block) => {
    expect(docSchema.safeParse({ type: "doc", content: [block] }).success).toBe(false);
  });
});

describe("document-schema — 강제 줄바꿈은 문단 안에만 온다", () => {
  const broken = [
    { type: "text", text: "첫 줄" },
    { type: "hardBreak" },
    { type: "text", text: "둘째 줄" },
  ];

  it("WHEN 최상위 문단과 목록 항목 문단에 hardBreak를 두면 THEN success는 true다", () => {
    const topLevel = { type: "doc", content: [{ type: "paragraph", content: broken }] };
    const inList = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: broken }] }],
        },
      ],
    };
    expect(docSchema.safeParse(topLevel).success).toBe(true);
    expect(docSchema.safeParse(inList).success).toBe(true);
  });

  const inCell = {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: [{ type: "tableCell", content: [{ type: "paragraph", content: broken }] }],
      },
    ],
  };
  it.each([
    ["제목 안 hardBreak", { type: "heading", attrs: { level: 2 }, content: broken }],
    ["표 칸 문단 안 hardBreak", inCell],
    [
      "마크 붙은 hardBreak",
      { type: "paragraph", content: [{ type: "hardBreak", marks: [{ type: "bold" }] }] },
    ],
  ])("WHEN %s를 파싱하면 THEN success는 false다", (_label, block) => {
    expect(docSchema.safeParse({ type: "doc", content: [block] }).success).toBe(false);
  });
});
