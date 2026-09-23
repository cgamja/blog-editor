import fc from "fast-check";
import type { Doc } from "./doc";
import {
  FONTS,
  MOTIONS,
  STICKER_IDS,
  CALLOUT_TONES,
  WIDTH_RANGE,
  STICKER_RANGES,
  MAX_STICKERS_PER_DOC,
} from "./doc";

/**
 * normalize의 멱등성 property test(3.2) 전용 — docSchema를 통과하는 임의 문서를 만든다.
 * 테스트 전용이라 index.ts에서 export하지 않는다(tasks 3.2). 닫힌 집합 상수는 doc.ts에서
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

const markArb = fc.oneof(
  fc.constant({ type: "bold" as const }),
  fc.constant({ type: "italic" as const }),
  fc.constant({ type: "code" as const }),
  fc.constantFrom(...LINK_HREFS).map((href) => ({ type: "link" as const, attrs: { href } })),
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

const stickerArb = fc.record({
  id: fc.constantFrom(...STICKER_IDS),
  x: fc.integer({ min: STICKER_RANGES.x.min, max: STICKER_RANGES.x.max }),
  y: fc.integer({ min: STICKER_RANGES.y.min, max: STICKER_RANGES.y.max }),
  size: fc.integer({ min: STICKER_RANGES.size.min, max: STICKER_RANGES.size.max }),
  rotate: fc.integer({ min: STICKER_RANGES.rotate.min, max: STICKER_RANGES.rotate.max }),
});

/** 최상위 블록 attrs — font/width는 자리가 있는 블록에서만 켠다(옵션으로 제어). */
function decorationArb(opts: { font: boolean; width: boolean; maxStickers: number }) {
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
      stickers: fc.array(stickerArb, { maxLength: opts.maxStickers }),
    })
    .map(({ font, motion, width, stickers }) => {
      const attrs: Record<string, unknown> = {};
      if (font !== undefined) attrs.font = font;
      if (motion !== undefined) attrs.motion = motion;
      if (width !== undefined) attrs.width = width;
      if (stickers.length > 0) attrs.stickers = stickers;
      return attrs;
    });
}

/** 인용 · 콜아웃 · listItem 안쪽 문단 — 꾸미기 자리가 없다(decoration-schema: 안쪽 노드에는 attrs 없음) */
const innerParagraphArb = fc.record({
  type: fc.constant("paragraph" as const),
  content: fc.array(inlineArb, { maxLength: 2 }),
});

const paragraphArb = fc.record({
  type: fc.constant("paragraph" as const),
  attrs: decorationArb({ font: true, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
  content: fc.array(inlineArb, { maxLength: 3 }),
});

const headingArb = fc
  .record({
    level: fc.constantFrom(2, 3),
    attrs: decorationArb({ font: true, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
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
  attrs: decorationArb({ font: true, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
  content: fc.array(innerParagraphArb, { minLength: 1, maxLength: 2 }),
});

const codeBlockArb = fc.record({
  type: fc.constant("codeBlock" as const),
  attrs: decorationArb({ font: false, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
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
  attrs: decorationArb({ font: false, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
});

// listItem 재귀는 depth <= 2까지만 — 스펙 "nested listItem lists depth ≤ 2"
// depth 0(최상위에서 직접 쓴 리스트)만 attrs가 있다 — listItem 안에 중첩된 리스트는 안쪽 노드라
// attrs 자리 자체가 없다(decoration-schema).
function listArb(
  type: "bulletList" | "orderedList",
  depth: number,
): fc.Arbitrary<Record<string, unknown>> {
  const content = fc.array(listItemArb(depth), { minLength: 1, maxLength: 2 });
  return depth === 0
    ? fc.record({
        type: fc.constant(type),
        attrs: decorationArb({ font: true, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
        content,
      })
    : fc.record({ type: fc.constant(type), content });
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

const imageArb = fc.record({
  type: fc.constant("image" as const),
  attrs: fc
    .tuple(
      fc.constantFrom("/images/a1.webp", "/images/b2.png"),
      decorationArb({ font: false, width: true, maxStickers: STICKER_CAP_PER_BLOCK }),
    )
    .map(([src, deco]) => ({ src, alt: "", ...deco })),
});

/** callout 안 bulletList/orderedList — 안쪽 노드라 attrs 자리가 없다(listArb depth 0과 다르다). */
function calloutListArb(type: "bulletList" | "orderedList"): fc.Arbitrary<Record<string, unknown>> {
  return fc.record({
    type: fc.constant(type),
    content: fc.array(
      fc.record({
        type: fc.constant("listItem" as const),
        content: innerParagraphArb.map((paragraphNode) => [paragraphNode]),
      }),
      { minLength: 1, maxLength: 2 },
    ),
  });
}

const calloutArb = fc.record({
  type: fc.constant("callout" as const),
  attrs: fc
    .tuple(
      fc.constantFrom(...CALLOUT_TONES),
      decorationArb({ font: true, width: false, maxStickers: STICKER_CAP_PER_BLOCK }),
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
      decorationArb({ font: false, width: true, maxStickers: STICKER_CAP_PER_BLOCK }),
    )
    .map(([src, deco]) => ({ src, caption: "", ...deco })),
});

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
);

/** 블록 최대 MAX_BLOCKS_PER_DOC개 × 블록당 최대 STICKER_CAP_PER_BLOCK개 — 문서당 스티커 상한을 절대 넘지 않는다. */
export const docArbitrary: fc.Arbitrary<Doc> = fc
  .array(topLevelBlockArb, { minLength: 1, maxLength: MAX_BLOCKS_PER_DOC })
  .map((content) => ({ type: "doc" as const, content })) as fc.Arbitrary<Doc>;
