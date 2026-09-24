import fc from "fast-check";
import { Node } from "@tiptap/pm/model";
import { fixtures, invalidFixtures, normalize } from "@blog-editor/content-schema";
import { docArbitrary } from "@blog-editor/content-schema/testing";
import { createEditorSchema, docFromNode, docToNode } from "./index";

const schema = createEditorSchema();

/** zod 층이 원인인 잘못된 픽스처 — future-version은 doc이 아니라 schemaVersion이 원인이라 뺀다. */
const DOC_LEVEL_INVALID = [
  "javascript-link",
  "absolute-image",
  "unknown-attr",
  "too-many-stickers",
];

describe("editor-schema: 저장 문서는 에디터 스키마를 오가도 바뀌지 않는다", () => {
  it.each(Object.entries(fixtures))(
    "WHEN 유효 픽스처 %s를 docToNode → docFromNode로 돌린다 THEN normalize 결과와 같다",
    (_name, file) => {
      expect(docFromNode(docToNode(schema, file.doc))).toEqual(normalize(file.doc));
    },
  );

  it("WHEN docArbitrary 표본을 docToNode → docFromNode로 돌린다 THEN 모두 normalize 결과와 같다", () => {
    fc.assert(
      fc.property(docArbitrary, (doc) => {
        expect(docFromNode(docToNode(schema, doc))).toEqual(normalize(doc));
      }),
      { numRuns: 1000 },
    );
  });
});

describe("editor-schema: 층마다 막는 것이 정해져 있다", () => {
  it.each(invalidFixtures.filter(({ name }) => DOC_LEVEL_INVALID.includes(name)))(
    "WHEN zod만 잡는 잘못된 픽스처 $name을 docToNode에 넣는다 THEN 거부된다",
    ({ file }) => {
      expect(() => docToNode(schema, (file as { doc: unknown }).doc)).toThrow();
    },
  );

  const text = (value: string) => ({ type: "text", text: value });
  const paragraph = { type: "paragraph", content: [text("가")] };
  it.each([
    ["빈 문서", { type: "doc", content: [] }],
    ["모르는 노드 이름", { type: "doc", content: [{ type: "table" }] }],
    ["빈 텍스트", { type: "doc", content: [{ type: "paragraph", content: [text("")] }] }],
    [
      "인용 안의 제목",
      {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [{ type: "heading", attrs: { level: 2 }, content: [text("가")] }],
          },
        ],
      },
    ],
    [
      "첫 자식이 목록인 목록 항목",
      {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "bulletList", content: [{ type: "listItem", content: [paragraph] }] },
                ],
              },
            ],
          },
        ],
      },
    ],
    [
      "코드 블록 안 굵은 글씨",
      {
        type: "doc",
        content: [{ type: "codeBlock", content: [{ ...text("가"), marks: [{ type: "bold" }] }] }],
      },
    ],
    [
      "목록 항목 안의 이미지",
      {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [paragraph, { type: "image", attrs: { src: "/images/a.webp", alt: "" } }],
              },
            ],
          },
        ],
      },
    ],
  ])("WHEN %s를 ProseMirror 스키마에 바로 넣는다 THEN 거부된다", (_label, json) => {
    expect(() => Node.fromJSON(schema, json).check()).toThrow();
  });

  it("WHEN 인용 안 문단에 font를 준 노드를 docFromNode로 꺼낸다 THEN 거부된다", () => {
    // 같은 paragraph 타입이라 ProseMirror 스키마는 받아들인다 — 거부는 저장 쪽 경계의 몫이다
    const decorated = Node.fromJSON(schema, {
      type: "doc",
      content: [{ type: "blockquote", content: [{ ...paragraph, attrs: { font: "jua" } }] }],
    });
    decorated.check();
    expect(() => docFromNode(decorated)).toThrow();
  });

  it("WHEN attrs 없는 제목 노드를 docFromNode로 꺼낸다 THEN 거부된다", () => {
    // ProseMirror는 attrs 객체가 없으면 필수 level도 null로 채워 받아들인다 — 최종 방어선은 zod다
    const levelless = Node.fromJSON(schema, {
      type: "doc",
      content: [{ type: "heading", content: [text("가")] }],
    });
    levelless.check();
    expect(() => docFromNode(levelless)).toThrow();
  });
});
