import fc from "fast-check";
import {
  CALLOUT_TONES,
  FONTS,
  MOTIONS,
  NATURAL_SIZE_RANGE,
  WIDTH_RANGE,
  docSchema,
} from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";

/**
 * 왕복 속성 테스트(markdown-serialize) 전용 — 스티커 · 빈 문단이 없는 유효 doc를 만든다. 테스트
 * 전용이라 index.ts에서 export하지 않는다. content-schema의 docArbitrary를 쓰지 않는 이유는
 * design.md 5번: 패키지 exports 밖이고, 그 글자는 ASCII뿐이라 한글 · 줄바꿈 경계를 못 만든다.
 */

/** markdown 문법 글자 · 한글 · 공백류를 섞는다 — 이스케이프와 flanking 경계를 두드리는 게 목적이다. */
const TEXT_UNITS = [
  "가",
  "한",
  "a",
  "1",
  " ",
  "\t",
  "\n",
  "*",
  "_",
  "`",
  "[",
  "]",
  "<",
  ">",
  "&",
  "!",
  "#",
  "-",
  "+",
  "=",
  "{",
  "}",
  ":",
  ".",
  "(",
  ")",
  "~",
  "\\",
  '"',
  "|",
] as const;

/**
 * 코드 마크 글자 — 줄바꿈은 코드 스팬에서 공백이 되고(design.md 6번), `:`를 빼 `]:`가 생기지 않게
 * 한다: 줄 첫 링크 안 코드의 `]:`는 참조 정의로 읽혀 losses(codeMark)가 된다(design.md 7번). 이웃
 * 코드 노드는 normalize에서 합쳐지므로 노드마다 거르는 것으로는 부족하다.
 */
const CODE_TEXT_UNITS = TEXT_UNITS.filter((unit) => unit !== "\n" && unit !== ":");

const LINK_HREFS = [
  "/blog/",
  "/x(y)",
  "https://example.com/a_b*c?d=1",
  "mailto:hi@example.com",
  "/a&amp;b",
] as const;

const textArb = fc.string({ unit: fc.constantFrom(...TEXT_UNITS), minLength: 1, maxLength: 6 });
const codeMarkTextArb = fc.string({
  unit: fc.constantFrom(...CODE_TEXT_UNITS),
  minLength: 1,
  maxLength: 5,
});

const inlineArb = fc
  .record({
    bold: fc.boolean(),
    italic: fc.boolean(),
    code: fc.boolean(),
    link: fc.option(fc.constantFrom(...LINK_HREFS), { nil: undefined }),
  })
  .chain(({ bold, italic, code, link }) =>
    (code ? codeMarkTextArb : textArb).map((text) => {
      const marks: Record<string, unknown>[] = [];
      if (bold) marks.push({ type: "bold" });
      if (italic) marks.push({ type: "italic" });
      if (code) marks.push({ type: "code" });
      if (link !== undefined) marks.push({ type: "link", attrs: { href: link } });
      return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
    }),
  );

/** 빈 문단이 없게 — 인라인은 최소 하나. */
const inlinesArb = fc.array(inlineArb, { minLength: 1, maxLength: 4 });

const paragraphInner = inlinesArb.map((content) => ({ type: "paragraph", content }));

function decoration(opts: { font: boolean; width: boolean }) {
  return fc
    .record({
      font: opts.font
        ? fc.option(fc.constantFrom(...FONTS), { nil: undefined })
        : fc.constant(undefined),
      motion: fc.option(fc.constantFrom(...MOTIONS), { nil: undefined }),
      width: opts.width
        ? fc.option(fc.integer({ min: WIDTH_RANGE.min, max: WIDTH_RANGE.max }), { nil: undefined })
        : fc.constant(undefined),
    })
    .map((attrs) => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined) result[key] = value;
      }
      return result;
    });
}

function withAttrs<T extends Record<string, unknown>>(
  node: T,
  attrs: Record<string, unknown>,
): T & { attrs?: Record<string, unknown> } {
  return Object.keys(attrs).length > 0 ? { ...node, attrs } : node;
}

function listArb(depth: number): fc.Arbitrary<Record<string, unknown>> {
  const nested = depth < 2 ? fc.array(listArb(depth + 1), { maxLength: 2 }) : fc.constant([]);
  const item = fc
    .tuple(paragraphInner, nested)
    .map(([paragraph, lists]) => ({ type: "listItem", content: [paragraph, ...lists] }));
  return fc
    .tuple(
      fc.constantFrom("bulletList", "orderedList"),
      fc.array(item, { minLength: 1, maxLength: 11 }),
    )
    .map(([type, content]) => ({ type, content }));
}

const topParagraph = fc
  .tuple(inlinesArb, decoration({ font: true, width: false }))
  .map(([content, attrs]) => withAttrs({ type: "paragraph", content }, attrs));

const heading = fc
  .tuple(
    fc.constantFrom(2, 3),
    fc.array(inlineArb, { maxLength: 3 }),
    decoration({ font: true, width: false }),
  )
  .map(([level, content, attrs]) => {
    const node: Record<string, unknown> = { type: "heading", attrs: { level, ...attrs } };
    if (content.length > 0) node.content = content;
    return node;
  });

const blockquote = fc
  .tuple(
    fc.array(paragraphInner, { minLength: 1, maxLength: 3 }),
    decoration({ font: true, width: false }),
  )
  .map(([content, attrs]) => withAttrs({ type: "blockquote", content }, attrs));

const codeBlock = fc
  .tuple(
    fc.option(fc.constantFrom("ts", "c++", "c#", "sh"), { nil: undefined }),
    fc.option(
      fc.string({ unit: fc.constantFrom(...TEXT_UNITS, "`"), minLength: 1, maxLength: 12 }),
      {
        nil: undefined,
      },
    ),
    decoration({ font: false, width: false }),
  )
  .map(([language, text, attrs]) => {
    const node: Record<string, unknown> = withAttrs(
      { type: "codeBlock" },
      language !== undefined ? { language, ...attrs } : attrs,
    );
    if (text !== undefined) node.content = [{ type: "text", text }];
    return node;
  });

const horizontalRule = decoration({ font: false, width: false }).map((attrs) =>
  withAttrs({ type: "horizontalRule" }, attrs),
);

const altArb = fc.string({ unit: fc.constantFrom(...TEXT_UNITS), maxLength: 8 });

/** 원본 크기는 짝으로만 있거나 없다 — size 지시어로 왕복한다. */
const naturalSize = fc
  .option(
    fc.tuple(
      fc.integer({ min: NATURAL_SIZE_RANGE.min, max: NATURAL_SIZE_RANGE.max }),
      fc.integer({ min: NATURAL_SIZE_RANGE.min, max: NATURAL_SIZE_RANGE.max }),
    ),
    { nil: undefined },
  )
  .map((size) => (size === undefined ? {} : { naturalWidth: size[0], naturalHeight: size[1] }));

const image = fc
  .tuple(altArb, naturalSize, decoration({ font: false, width: true }))
  .map(([alt, size, attrs]) => ({
    type: "image",
    attrs: { src: "/images/a-1.webp", alt, ...size, ...attrs },
  }));

const appScreenshot = fc
  .tuple(altArb, naturalSize, decoration({ font: false, width: true }))
  .map(([caption, size, attrs]) => ({
    type: "appScreenshot",
    attrs: { src: "/images/shot.png", caption, ...size, ...attrs },
  }));

const calloutList = fc
  .tuple(
    fc.constantFrom("bulletList", "orderedList"),
    fc.array(
      paragraphInner.map((paragraph) => ({ type: "listItem", content: [paragraph] })),
      { minLength: 1, maxLength: 3 },
    ),
  )
  .map(([type, content]) => ({ type, content }));

const callout = fc
  .tuple(
    fc.constantFrom(...CALLOUT_TONES),
    fc.array(fc.oneof(paragraphInner, calloutList), { minLength: 1, maxLength: 3 }),
    decoration({ font: true, width: false }),
  )
  .map(([tone, content, attrs]) => ({ type: "callout", attrs: { tone, ...attrs }, content }));

const topList = fc
  .tuple(listArb(0), decoration({ font: true, width: false }))
  .map(([list, attrs]) => withAttrs(list, attrs));

const topLevelBlock = fc.oneof(
  topParagraph,
  heading,
  blockquote,
  codeBlock,
  horizontalRule,
  image,
  appScreenshot,
  callout,
  topList,
);

/** 스티커 · 빈 문단 없는 유효 doc — 만든 즉시 docSchema로 거른다(생성기 자체의 실수를 가리지 않게 parse). */
export const losslessDocArbitrary: fc.Arbitrary<Doc> = fc
  .array(topLevelBlock, { minLength: 1, maxLength: 5 })
  .map((content) => docSchema.parse({ type: "doc", content }));
