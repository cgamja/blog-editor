import fc from "fast-check";
import type { Doc } from "./doc";
import {
  ALIGNS,
  FONTS,
  HIGHLIGHT_COLORS,
  MOTIONS,
  STICKER_IDS,
  CALLOUT_TONES,
  TEXT_COLORS,
  TEXT_SIZES,
  TEXT_WEIGHTS,
  WIDTH_RANGE,
  NATURAL_SIZE_RANGE,
  STICKER_RANGES,
  MAX_STICKERS_PER_DOC,
  ORDERED_LIST_START_RANGE,
  textStyleAttrsSchema,
} from "./doc";

/**
 * property test 전용 — docSchema를 통과하는 임의 문서와 그 속성 생성기를 만든다.
 * 런타임 진입점(index.ts)이 아니라 `./testing` 진입점(package.json exports)으로만 나간다(adr-015).
 * 이 파일 · `./testing` · fast-check는 *.test.ts와 *.arbitrary.ts에서만 import할 수 있고, 그 밖의
 * 파일에서는 eslint.config.mjs의 GENERATORS 규칙이 막는다. 닫힌 집합 상수는 doc.ts에서
 * 그대로 가져온다 — 값이 늘어나면 여기도 자동으로 따라오지만, 새 노드 종류가 생기면 이 생성기를
 * 손으로 갱신해야 하고 지금은 그 누락을 잡는 것이 없다(adr-012 참고).
 */

const LINK_HREFS = [
  "https://example.com/a?b=1",
  "http://localhost:3000",
  "mailto:hi@example.com",
  "/blog/first-post",
] as const;

/** 최상위 블록 최대 4개 × 블록당 스티커 상한을 곱해도 문서 전체 상한(MAX_STICKERS_PER_DOC)을 넘지 않게. */
const MAX_BLOCKS_PER_DOC = 4;
const STICKER_CAP_PER_BLOCK = Math.floor(MAX_STICKERS_PER_DOC / MAX_BLOCKS_PER_DOC);

/** 문단 인라인에서 글자 : 강제 줄바꿈 비율 — 줄바꿈이 이어지는 모양도 나올 만큼, 글자가 대부분이게 */
const TEXT_INLINE_WEIGHT = 4;
const HARD_BREAK_WEIGHT = 1;

const HEX_MAX = 0xffffff;
const HEX_DIGITS = 6;
const hexColorArb = fc
  .integer({ min: 0, max: HEX_MAX })
  .map((value) => `#${value.toString(16).padStart(HEX_DIGITS, "0")}`);

/**
 * textStyle attrs — 빈 스타일 · 글꼴에 없는 두께는 스키마로 거른다(규칙을 여기서 다시 적지 않는다).
 * 값이 없는 키는 빼서 정규형과 같은 모양으로 낸다.
 */
export const textStyleArbitrary = fc
  .record({
    font: fc.option(fc.constantFrom(...FONTS), { nil: undefined }),
    weight: fc.option(fc.constantFrom(...TEXT_WEIGHTS), { nil: undefined }),
    size: fc.option(fc.constantFrom(...TEXT_SIZES), { nil: undefined }),
    color: fc.option(fc.oneof(fc.constantFrom(...TEXT_COLORS), hexColorArb), { nil: undefined }),
    highlight: fc.option(fc.oneof(fc.constantFrom(...HIGHLIGHT_COLORS), hexColorArb), {
      nil: undefined,
    }),
  })
  .map((style) =>
    Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined)),
  )
  .filter((style) => textStyleAttrsSchema.safeParse(style).success);

const markArb = fc.oneof(
  fc.constant({ type: "bold" as const }),
  fc.constant({ type: "italic" as const }),
  fc.constant({ type: "code" as const }),
  fc.constantFrom(...LINK_HREFS).map((href) => ({ type: "link" as const, attrs: { href } })),
  fc.constant({ type: "strike" as const }),
  fc.constant({ type: "underline" as const }),
  textStyleArbitrary.map((attrs) => ({ type: "textStyle" as const, attrs })),
);

/** 같은 텍스트 안에 같은 마크 type이 중복되지 않게 걸러낸다(docSchema가 중복 마크를 거부한다). */
const uniqueByType = <T extends { type: string }>(marks: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const mark of marks) {
    if (seen.has(mark.type)) continue;
    seen.add(mark.type);
    result.push(mark);
  }
  return result;
};

const inlineArb = fc
  .record({
    text: fc.string({ minLength: 1, maxLength: 12 }),
    marks: fc.array(markArb, { maxLength: 3 }),
  })
  .map(({ text, marks }) => {
    const deduped = uniqueByType(marks);
    return deduped.length > 0
      ? { type: "text" as const, text, marks: deduped }
      : { type: "text" as const, text };
  });

/** 문단 인라인 — 글자에 강제 줄바꿈(adr-028)을 섞는다. 제목 · 표 칸은 글자만(inlineArb) */
const paragraphInlineArb = fc.oneof(
  { arbitrary: inlineArb, weight: TEXT_INLINE_WEIGHT },
  { arbitrary: fc.constant({ type: "hardBreak" as const }), weight: HARD_BREAK_WEIGHT },
);

const stickerArb = fc.record({
  id: fc.constantFrom(...STICKER_IDS),
  x: fc.integer({ min: STICKER_RANGES.x.min, max: STICKER_RANGES.x.max }),
  y: fc.integer({ min: STICKER_RANGES.y.min, max: STICKER_RANGES.y.max }),
  size: fc.integer({ min: STICKER_RANGES.size.min, max: STICKER_RANGES.size.max }),
  rotate: fc.integer({ min: STICKER_RANGES.rotate.min, max: STICKER_RANGES.rotate.max }),
});

/** 최상위 블록 attrs — font/width/align은 자리가 있는 블록에서만 켠다(옵션으로 제어). */
export function decorationArbitrary(opts: {
  font: boolean;
  width: boolean;
  align?: boolean;
  maxStickers: number;
}) {
  return fc
    .record({
      font: opts.font
        ? fc.option(fc.constantFrom(...FONTS), { nil: undefined })
        : fc.constant(undefined),
      motion: fc.option(fc.constantFrom(...MOTIONS), { nil: undefined }),
      width: opts.width
        ? fc.option(fc.integer({ min: WIDTH_RANGE.min, max: WIDTH_RANGE.max }), {
            nil: undefined,
          })
        : fc.constant(undefined),
      align: opts.align
        ? fc.option(fc.constantFrom(...ALIGNS), { nil: undefined })
        : fc.constant(undefined),
      stickers: fc.array(stickerArb, { maxLength: opts.maxStickers }),
    })
    .map(({ font, motion, width, align, stickers }) => {
      const attrs: Record<string, unknown> = {};
      if (font !== undefined) attrs.font = font;
      if (motion !== undefined) attrs.motion = motion;
      if (width !== undefined) attrs.width = width;
      if (align !== undefined) attrs.align = align;
      if (stickers.length > 0) attrs.stickers = stickers;
      return attrs;
    });
}

/** 인용 · 콜아웃 · listItem 안쪽 문단 — 꾸미기 자리가 없다(decoration-schema: 안쪽 노드에는 attrs 없음) */
const innerParagraphArb = fc.record({
  type: fc.constant("paragraph" as const),
  content: fc.array(paragraphInlineArb, { maxLength: 2 }),
});

/** 표 칸 안 문단 — 한 줄 문법이라 글자만(adr-028) */
const cellParagraphArb = fc.record({
  type: fc.constant("paragraph" as const),
  content: fc.array(inlineArb, { maxLength: 2 }),
});

const paragraphArb = fc.record({
  type: fc.constant("paragraph" as const),
  attrs: decorationArbitrary({
    font: true,
    width: false,
    align: true,
    maxStickers: STICKER_CAP_PER_BLOCK,
  }),
  content: fc.array(paragraphInlineArb, { maxLength: 3 }),
});

const headingArb = fc
  .record({
    level: fc.constantFrom(2, 3),
    attrs: decorationArbitrary({
      font: true,
      width: false,
      align: true,
      maxStickers: STICKER_CAP_PER_BLOCK,
    }),
  })
  .chain(({ level, attrs }) =>
    fc.record({
      type: fc.constant("heading" as const),
      attrs: fc.constant({ level, ...attrs }),
      content: fc.array(inlineArb, { maxLength: 3 }),
    }),
  );

const blockquoteArb = fc.record({
  type: fc.constant("blockquote" as const),
  attrs: decorationArbitrary({ font: true, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
  content: fc.array(innerParagraphArb, { minLength: 1, maxLength: 2 }),
});

const codeBlockArb = fc.record({
  type: fc.constant("codeBlock" as const),
  attrs: decorationArbitrary({ font: false, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
  content: fc.array(
    fc.record({
      type: fc.constant("text" as const),
      text: fc.string({ minLength: 1, maxLength: 12 }),
    }),
    {
      maxLength: 2,
    },
  ),
});

const horizontalRuleArb = fc.record({
  type: fc.constant("horizontalRule" as const),
  attrs: decorationArbitrary({ font: false, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
});

// listItem 재귀는 depth <= 2까지만 — 스펙 "nested listItem lists depth ≤ 2"
// depth 0(최상위에서 직접 쓴 리스트)만 꾸미기가 있다 — listItem 안에 중첩된 리스트는 안쪽 노드라
// 꾸미기 자리가 없고 번호 목록 시작 번호만 있다(decoration-schema · ordered-list-start).
/** 번호 목록 시작 번호 — 없거나 범위 안(1은 normalize가 지운다) */
const orderedListStartArb = fc.option(
  fc.integer({ min: ORDERED_LIST_START_RANGE.min, max: ORDERED_LIST_START_RANGE.max }),
  { nil: undefined },
);

/** 번호 목록이면 시작 번호를 attrs에 얹는다 — 안쪽 목록은 attrs가 시작 번호뿐이다(ordered-list-start) */
function withStart(
  type: "bulletList" | "orderedList",
  list: fc.Arbitrary<Record<string, unknown>>,
): fc.Arbitrary<Record<string, unknown>> {
  if (type === "bulletList") return list;
  return fc
    .tuple(list, orderedListStartArb)
    .map(([node, start]) =>
      start === undefined
        ? node
        : { ...node, attrs: { ...(node.attrs as Record<string, unknown> | undefined), start } },
    );
}

function listArb(
  type: "bulletList" | "orderedList",
  depth: number,
): fc.Arbitrary<Record<string, unknown>> {
  const content = fc.array(listItemArb(depth), { minLength: 1, maxLength: 2 });
  return withStart(
    type,
    depth === 0
      ? fc.record({
          type: fc.constant(type),
          attrs: decorationArbitrary({
            font: true,
            width: false,
            maxStickers: STICKER_CAP_PER_BLOCK,
          }),
          content,
        })
      : fc.record({ type: fc.constant(type), content }),
  );
}

function listItemArb(depth: number): fc.Arbitrary<Record<string, unknown>> {
  const paragraph = innerParagraphArb;
  const nested =
    depth < 2
      ? fc.array(fc.oneof(listArb("bulletList", depth + 1), listArb("orderedList", depth + 1)), {
          maxLength: 1,
        })
      : fc.constant([]);
  return fc.tuple(paragraph, nested).map(([paragraphNode, nestedLists]) => ({
    type: "listItem" as const,
    content: [paragraphNode, ...nestedLists],
  }));
}

/** 원본 크기는 짝으로만 있거나 없다(document-schema). */
export const naturalSizeArbitrary = fc
  .option(
    fc.tuple(
      fc.integer({ min: NATURAL_SIZE_RANGE.min, max: NATURAL_SIZE_RANGE.max }),
      fc.integer({ min: NATURAL_SIZE_RANGE.min, max: NATURAL_SIZE_RANGE.max }),
    ),
    { nil: undefined },
  )
  .map((size) => (size === undefined ? {} : { naturalWidth: size[0], naturalHeight: size[1] }));

const imageArb = fc.record({
  type: fc.constant("image" as const),
  attrs: fc
    .tuple(
      fc.constantFrom("/images/a1.webp", "/images/b2.png"),
      naturalSizeArbitrary,
      decorationArbitrary({
        font: false,
        width: true,
        align: true,
        maxStickers: STICKER_CAP_PER_BLOCK,
      }),
    )
    .map(([src, size, deco]) => ({ src, alt: "", ...size, ...deco })),
});

/** callout 안 bulletList/orderedList — 안쪽 노드라 꾸미기 자리가 없다(listArb depth 0과 다르다). */
function calloutListArb(type: "bulletList" | "orderedList"): fc.Arbitrary<Record<string, unknown>> {
  return withStart(
    type,
    fc.record({
      type: fc.constant(type),
      content: fc.array(
        fc.record({
          type: fc.constant("listItem" as const),
          content: innerParagraphArb.map((paragraphNode) => [paragraphNode]),
        }),
        { minLength: 1, maxLength: 2 },
      ),
    }),
  );
}

const calloutArb = fc.record({
  type: fc.constant("callout" as const),
  attrs: fc
    .tuple(
      fc.constantFrom(...CALLOUT_TONES),
      decorationArbitrary({ font: true, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
    )
    .map(([tone, deco]) => ({ tone, ...deco })),
  content: fc.array(
    fc.oneof(innerParagraphArb, calloutListArb("bulletList"), calloutListArb("orderedList")),
    {
      minLength: 1,
      maxLength: 2,
    },
  ),
});

const appScreenshotArb = fc.record({
  type: fc.constant("appScreenshot" as const),
  attrs: fc
    .tuple(
      fc.constant("/images/shot1.webp"),
      naturalSizeArbitrary,
      decorationArbitrary({
        font: false,
        width: true,
        align: true,
        maxStickers: STICKER_CAP_PER_BLOCK,
      }),
    )
    .map(([src, size, deco]) => ({ src, caption: "", ...size, ...deco })),
});

const MAX_TABLE_SIDE = 3;

/**
 * 표 — 직사각형, 첫 행이 머리 행이고 열 정렬은 머리 행 칸에만 있다(adr-028). 칸 안은 안쪽 문단 하나.
 * 꾸미기는 목록 · 인용과 같은 font · motion · stickers.
 */
const tableArb = fc
  .record({
    columns: fc.integer({ min: 1, max: MAX_TABLE_SIDE }),
    rows: fc.integer({ min: 1, max: MAX_TABLE_SIDE }),
  })
  .chain(({ columns, rows }) =>
    fc.record({
      type: fc.constant("table" as const),
      attrs: decorationArbitrary({ font: true, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
      content: fc
        .tuple(
          fc.array(fc.option(fc.constantFrom(...ALIGNS), { nil: undefined }), {
            minLength: columns,
            maxLength: columns,
          }),
          fc.array(fc.array(cellParagraphArb, { minLength: columns, maxLength: columns }), {
            minLength: rows,
            maxLength: rows,
          }),
        )
        .map(([aligns, grid]) =>
          grid.map((cells, row) => ({
            type: "tableRow" as const,
            content: cells.map((paragraph, column) => {
              const align = row === 0 ? aligns[column] : undefined;
              return align === undefined
                ? { type: "tableCell" as const, content: [paragraph] }
                : { type: "tableCell" as const, attrs: { align }, content: [paragraph] };
            }),
          })),
        ),
    }),
  );

const topLevelBlockArb = fc.oneof(
  paragraphArb,
  headingArb,
  blockquoteArb,
  codeBlockArb,
  horizontalRuleArb,
  imageArb,
  calloutArb,
  appScreenshotArb,
  listArb("bulletList", 0),
  listArb("orderedList", 0),
  tableArb,
);

/** 블록 최대 MAX_BLOCKS_PER_DOC개 × 블록당 최대 STICKER_CAP_PER_BLOCK개 — 문서당 스티커 상한을 절대 넘지 않는다. */
export const docArbitrary: fc.Arbitrary<Doc> = fc
  .array(topLevelBlockArb, { minLength: 1, maxLength: MAX_BLOCKS_PER_DOC })
  .map((content) => ({ type: "doc" as const, content })) as fc.Arbitrary<Doc>;
