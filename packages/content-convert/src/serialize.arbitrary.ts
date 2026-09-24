import fc from "fast-check";
import { CALLOUT_TONES, docSchema, ORDERED_LIST_START_RANGE } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import {
  decorationArbitrary,
  naturalSizeArbitrary,
  textStyleArbitrary,
} from "@blog-editor/content-schema/testing";

/**
 * 왕복 속성 테스트(markdown-serialize) 전용 — 스티커 · 빈 문단이 없는 유효 doc를 만든다. 테스트
 * 전용이라 index.ts에서 export하지 않는다. 꾸미기 · 원본 크기 생성기는 content-schema `./testing`의
 * 것을 쓴다 — 스키마에 속성이 늘면 거기 한 곳만 고친다(document-fixtures). docArbitrary 전체를 쓰지
 * 않는 이유: 그 글자는 ASCII뿐이라 한글 · 줄바꿈 · markdown 문법 경계를 못 만든다.
 */

/** 흔한 시작 번호(2 ~ 12) — 전체 범위만 뽑으면 거의 9자리 수라 작은 번호의 표지 · 들여쓰기를 못 본다 */
const SMALL_START_RANGE = { min: 2, max: 12 };

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
    strike: fc.boolean(),
    underline: fc.boolean(),
    textStyle: fc.option(textStyleArbitrary, { nil: undefined }),
  })
  .chain(({ bold, italic, code, link, strike, underline, textStyle }) =>
    (code ? codeMarkTextArb : textArb).map((text) => {
      const marks: Record<string, unknown>[] = [];
      if (bold) marks.push({ type: "bold" });
      if (italic) marks.push({ type: "italic" });
      if (code) marks.push({ type: "code" });
      if (link !== undefined) marks.push({ type: "link", attrs: { href: link } });
      if (strike) marks.push({ type: "strike" });
      if (underline) marks.push({ type: "underline" });
      if (textStyle !== undefined) marks.push({ type: "textStyle", attrs: textStyle });
      return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
    }),
  );

/** 빈 문단이 없게 — 인라인은 최소 하나. */
const inlinesArb = fc.array(inlineArb, { minLength: 1, maxLength: 4 });

const paragraphInner = inlinesArb.map((content) => ({ type: "paragraph", content }));

/** markdown에는 스티커 자리가 없다 — 공용 생성기에서 스티커만 끈다. */
const decoration = (opts: { font: boolean; width: boolean; align?: boolean }) =>
  decorationArbitrary({ ...opts, maxStickers: 0 });

function withAttrs<T extends Record<string, unknown>>(
  node: T,
  attrs: Record<string, unknown>,
): T & { attrs?: Record<string, unknown> } {
  return Object.keys(attrs).length > 0 ? { ...node, attrs } : node;
}

/** 번호 목록 시작 번호 — 없음(1) · 작은 수 · 9자리 상한까지 */
const orderedStartArb = fc.option(
  fc.oneof(
    fc.integer(SMALL_START_RANGE),
    fc.integer({ min: ORDERED_LIST_START_RANGE.min, max: ORDERED_LIST_START_RANGE.max }),
  ),
  { nil: undefined },
);

function withStart(
  list: fc.Arbitrary<{ type: string; content: unknown[] }>,
): fc.Arbitrary<Record<string, unknown>> {
  return fc
    .tuple(list, orderedStartArb)
    .map(([node, start]) =>
      node.type === "orderedList" && start !== undefined ? { ...node, attrs: { start } } : node,
    );
}

function listArb(depth: number): fc.Arbitrary<Record<string, unknown>> {
  const nested = depth < 2 ? fc.array(listArb(depth + 1), { maxLength: 2 }) : fc.constant([]);
  const item = fc
    .tuple(paragraphInner, nested)
    .map(([paragraph, lists]) => ({ type: "listItem", content: [paragraph, ...lists] }));
  return withStart(
    fc
      .tuple(
        fc.constantFrom("bulletList", "orderedList"),
        fc.array(item, { minLength: 1, maxLength: 11 }),
      )
      .map(([type, content]) => ({ type, content })),
  );
}

const topParagraph = fc
  .tuple(inlinesArb, decoration({ font: true, width: false, align: true }))
  .map(([content, attrs]) => withAttrs({ type: "paragraph", content }, attrs));

const heading = fc
  .tuple(
    fc.constantFrom(2, 3),
    fc.array(inlineArb, { maxLength: 3 }),
    decoration({ font: true, width: false, align: true }),
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

const image = fc
  .tuple(altArb, naturalSizeArbitrary, decoration({ font: false, width: true, align: true }))
  .map(([alt, size, attrs]) => ({
    type: "image",
    attrs: { src: "/images/a-1.webp", alt, ...size, ...attrs },
  }));

const appScreenshot = fc
  .tuple(altArb, naturalSizeArbitrary, decoration({ font: false, width: true, align: true }))
  .map(([caption, size, attrs]) => ({
    type: "appScreenshot",
    attrs: { src: "/images/shot.png", caption, ...size, ...attrs },
  }));

const calloutList = withStart(
  fc
    .tuple(
      fc.constantFrom("bulletList", "orderedList"),
      fc.array(
        paragraphInner.map((paragraph) => ({ type: "listItem", content: [paragraph] })),
        { minLength: 1, maxLength: 3 },
      ),
    )
    .map(([type, content]) => ({ type, content })),
);

const callout = fc
  .tuple(
    fc.constantFrom(...CALLOUT_TONES),
    fc.array(fc.oneof(paragraphInner, calloutList), { minLength: 1, maxLength: 3 }),
    decoration({ font: true, width: false }),
  )
  .map(([tone, content, attrs]) => ({ type: "callout", attrs: { tone, ...attrs }, content }));

const topList = fc
  .tuple(listArb(0), decoration({ font: true, width: false }))
  .map(([list, attrs]) => withAttrs(list, { ...(list.attrs as object | undefined), ...attrs }));

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
