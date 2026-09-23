import fc from "fast-check";
import type { Doc } from "./doc";

/**
 * normalize의 멱등성 property test(3.2) 전용 — docSchema를 통과하는 임의 문서를 만든다.
 * 테스트 전용이라 index.ts에서 export하지 않는다(tasks 3.2).
 */

const LINK_HREFS = [
  "https://example.com/a?b=1",
  "http://localhost:3000",
  "mailto:hi@example.com",
  "/blog/first-post",
] as const;
const FONTS = ["pretendard", "jua", "gaegu"] as const;
const MOTIONS = ["fade-in", "fade-up", "slide-left", "slide-right", "pop"] as const;
const STICKER_IDS = [
  "star-coral",
  "star-mint",
  "heart",
  "cloud",
  "bottle",
  "rattle",
  "pacifier",
  "foot-coral",
  "foot-mint",
] as const;

const markArb = fc.oneof(
  fc.constant({ type: "bold" as const }),
  fc.constant({ type: "italic" as const }),
  fc.constant({ type: "code" as const }),
  fc.constantFrom(...LINK_HREFS).map((href) => ({ type: "link" as const, attrs: { href } })),
);
// 같은 마크 타입이 한 텍스트에 중복되지 않게(정규화 대상은 "인접 텍스트"지 "같은 텍스트 중복 마크"가 아니다)
const uniqueByType = <T extends { type: string }>(marks: T[]) => {
  const seen = new Set<string>();
  return marks.filter((m) => (seen.has(m.type) ? false : seen.add(m.type)));
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
  x: fc.integer({ min: -25, max: 125 }),
  y: fc.integer({ min: -25, max: 125 }),
  size: fc.integer({ min: 5, max: 50 }),
  rotate: fc.integer({ min: -180, max: 180 }),
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
        ? fc.option(fc.integer({ min: 25, max: 100 }), { nil: undefined })
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
  attrs: decorationArb({ font: true, width: false, maxStickers: 3 }),
  content: fc.array(inlineArb, { maxLength: 3 }),
});

const headingArb = fc
  .record({
    level: fc.constantFrom(2, 3),
    attrs: decorationArb({ font: true, width: false, maxStickers: 3 }),
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
  attrs: decorationArb({ font: true, width: false, maxStickers: 2 }),
  content: fc.array(innerParagraphArb, { minLength: 1, maxLength: 2 }),
});

const codeBlockArb = fc.record({
  type: fc.constant("codeBlock" as const),
  attrs: decorationArb({ font: false, width: false, maxStickers: 2 }),
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
  attrs: decorationArb({ font: false, width: false, maxStickers: 1 }),
});

// listItem 재귀는 depth <= 2까지만 — 스펙 "nested listItem lists depth ≤ 2"
function listArb(
  type: "bulletList" | "orderedList",
  depth: number,
): fc.Arbitrary<Record<string, unknown>> {
  return fc.record({
    type: fc.constant(type),
    attrs: decorationArb({ font: true, width: false, maxStickers: 2 }),
    content: fc.array(listItemArb(depth), { minLength: 1, maxLength: 2 }),
  });
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
      decorationArb({ font: false, width: true, maxStickers: 2 }),
    )
    .map(([src, deco]) => ({ src, alt: "", ...deco })),
});

const calloutArb = fc.record({
  type: fc.constant("callout" as const),
  attrs: fc
    .tuple(
      fc.constantFrom("note", "tip", "warning"),
      decorationArb({ font: true, width: false, maxStickers: 2 }),
    )
    .map(([tone, deco]) => ({ tone, ...deco })),
  content: fc.array(innerParagraphArb, { minLength: 1, maxLength: 2 }),
});

const appScreenshotArb = fc.record({
  type: fc.constant("appScreenshot" as const),
  attrs: fc
    .tuple(
      fc.constant("/images/shot1.webp"),
      decorationArb({ font: false, width: true, maxStickers: 2 }),
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

/** 최대 4블록 × 블록당 최대 3스티커 = 최대 12 — 글 하나당 스티커 상한(12)을 절대 넘지 않는다. */
export const docArbitrary: fc.Arbitrary<Doc> = fc
  .array(topLevelBlockArb, { minLength: 1, maxLength: 4 })
  .map((content) => ({ type: "doc" as const, content })) as fc.Arbitrary<Doc>;
