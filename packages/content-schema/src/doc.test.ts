import { docSchema } from "./doc";

const allBlocksDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "안녕", marks: [{ type: "bold" }] }] },
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
    ["정의 밖 노드 table", { type: "doc", content: [{ type: "table", content: [] }] }],
    [
      "paragraph에 attrs.style",
      { type: "doc", content: [{ type: "paragraph", attrs: { style: "color:red" }, content: [] }] },
    ],
    [
      "heading.attrs.level = 1",
      { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [] }] },
    ],
    [
      "text에 marks underline",
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "underline" }] }],
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
          attrs: { font: "jua", stickers: [sticker({ x: -25, y: 125, size: 5, rotate: -180 })] },
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
      "sticker.size: 4",
      minimalParagraphDoc({ paragraph: { attrs: { stickers: [sticker({ size: 4 })] } } }),
    ],
    [
      "sticker.rotate: 181",
      minimalParagraphDoc({ paragraph: { attrs: { stickers: [sticker({ rotate: 181 })] } } }),
    ],
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
