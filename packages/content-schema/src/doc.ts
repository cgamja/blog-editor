import { z } from "zod";
import { imagePathSchema } from "./meta";

/**
 * 글 본문 doc의 닫힌 집합(spec: document-schema, decoration-schema).
 * ProseMirror JSON과 모양은 호환되지만 정의는 여기 zod가 하고, ProseMirror를 모른다(adr-003).
 */

// ── 1. 원시값 · 닫힌 집합 상수 ──────────────────────────────────────────────

export const FONTS = ["pretendard", "jua", "gaegu"] as const;
export const MOTIONS = ["fade-in", "fade-up", "slide-left", "slide-right", "pop"] as const;
export const STICKER_IDS = [
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
export const CALLOUT_TONES = ["note", "tip", "warning"] as const;
export const HEADING_LEVELS = [2, 3] as const;

/** Lighthouse 성능 기준(adr-008)의 상한 — 늘리려면 ADR. */
export const MAX_STICKERS_PER_DOC = 12;

export const WIDTH_RANGE = { min: 25, max: 100 } as const;
export const STICKER_RANGES = {
  x: { min: -25, max: 125 },
  y: { min: -25, max: 125 },
  size: { min: 5, max: 50 },
  rotate: { min: -180, max: 180 },
} as const;

export const ALT_MAX_LENGTH = 200;
export const CAPTION_MAX_LENGTH = 120;

const intInRange = (min: number, max: number) => z.number().int().min(min).max(max);

const widthSchema = intInRange(WIDTH_RANGE.min, WIDTH_RANGE.max);

/**
 * 호스트 필수 http(s) · mailto:<주소> · `//`로 시작하지 않는 내부 경로만 — 스킴 우회 방지(보호 대상).
 * 백슬래시와 C0 제어 문자는 어디에도 못 온다 — WHATWG URL 파서가 특수 스킴에서 `\`를 `/`로 읽어
 * `/\evil.com`이 외부로 나가고, 제어 문자는 스킴 검사를 우회하는 데 쓰일 수 있다.
 */
// eslint-disable-next-line no-control-regex -- \x00-\x1f/\x7f는 의도적으로 막는 대상이다(위 설명).
const HREF_HTTP_PATTERN = /^https?:\/\/[^\s\\\x00-\x1f\x7f/?#]+[^\s\\\x00-\x1f\x7f]*$/;
// eslint-disable-next-line no-control-regex -- 위와 같은 이유.
const HREF_MAILTO_PATTERN = /^mailto:[^\s\\\x00-\x1f\x7f@]+@[^\s\\\x00-\x1f\x7f@]+$/;
// eslint-disable-next-line no-control-regex -- 위와 같은 이유.
const HREF_INTERNAL_PATH_PATTERN = /^\/(?![/\\])[^\s\\\x00-\x1f\x7f]*$/;

export const hrefSchema = z
  .string()
  .refine(
    (value) =>
      HREF_HTTP_PATTERN.test(value) ||
      HREF_MAILTO_PATTERN.test(value) ||
      HREF_INTERNAL_PATH_PATTERN.test(value),
    { message: "href는 http(s)/mailto/내부 경로만 허용된다" },
  );

/** 소문자 · 숫자 · +/#/. 만 — 공백 · 대문자를 쓰면 거부된다("Bash Script" 등). */
const CODE_LANGUAGE_PATTERN = /^[a-z][a-z0-9+#.]*$/;

// ── 2. 마크 + 텍스트 ────────────────────────────────────────────────────

export const markSchema = z.union([
  z.strictObject({ type: z.literal("bold") }),
  z.strictObject({ type: z.literal("italic") }),
  z.strictObject({ type: z.literal("code") }),
  z.strictObject({ type: z.literal("link"), attrs: z.strictObject({ href: hrefSchema }) }),
]);

/** ProseMirror 마크 집합 규칙과 같다 — 한 텍스트에 같은 type이 두 번 올 수 없다. */
const marksArraySchema = z
  .array(markSchema)
  .refine((marks) => new Set(marks.map((mark) => mark.type)).size === marks.length, {
    message: "마크 type 중복",
  });

/** 최상위 인라인 텍스트 — bold/italic/code/link 마크만. */
const textSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: marksArraySchema.optional(),
});

/** codeBlock 안 텍스트 — "마크 없는 text"라 marks 자리 자체가 없다. */
const codeBlockTextSchema = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1),
});

// ── 3. 꾸미기(decoration) attrs ────────────────────────────────────────

const stickerSchema = z.strictObject({
  id: z.enum(STICKER_IDS),
  x: intInRange(STICKER_RANGES.x.min, STICKER_RANGES.x.max),
  y: intInRange(STICKER_RANGES.y.min, STICKER_RANGES.y.max),
  size: intInRange(STICKER_RANGES.size.min, STICKER_RANGES.size.max),
  rotate: intInRange(STICKER_RANGES.rotate.min, STICKER_RANGES.rotate.max),
});

/** 글자가 있는 블록(paragraph · blockquote · bulletList · orderedList)의 attrs. */
const textDecorationAttrsSchema = z.strictObject({
  font: z.enum(FONTS).optional(),
  motion: z.enum(MOTIONS).optional(),
  stickers: z.array(stickerSchema).optional(),
});

const headingAttrsSchema = z.strictObject({
  level: z.literal(HEADING_LEVELS),
  font: z.enum(FONTS).optional(),
  motion: z.enum(MOTIONS).optional(),
  stickers: z.array(stickerSchema).optional(),
});

const calloutAttrsSchema = z.strictObject({
  tone: z.enum(CALLOUT_TONES),
  font: z.enum(FONTS).optional(),
  motion: z.enum(MOTIONS).optional(),
  stickers: z.array(stickerSchema).optional(),
});

/** font는 글자가 있는 블록에만 — codeBlock/horizontalRule은 motion·stickers만. */
const motionOnlyAttrsSchema = z.strictObject({
  motion: z.enum(MOTIONS).optional(),
  stickers: z.array(stickerSchema).optional(),
});

const codeBlockAttrsSchema = z.strictObject({
  language: z.string().regex(CODE_LANGUAGE_PATTERN).optional(),
  motion: z.enum(MOTIONS).optional(),
  stickers: z.array(stickerSchema).optional(),
});

const imageAttrsSchema = z.strictObject({
  src: imagePathSchema,
  alt: z.string().max(ALT_MAX_LENGTH),
  motion: z.enum(MOTIONS).optional(),
  width: widthSchema.optional(),
  stickers: z.array(stickerSchema).optional(),
});

const appScreenshotAttrsSchema = z.strictObject({
  src: imagePathSchema,
  caption: z.string().max(CAPTION_MAX_LENGTH),
  motion: z.enum(MOTIONS).optional(),
  width: widthSchema.optional(),
  stickers: z.array(stickerSchema).optional(),
});

// ── 4. 안쪽 노드 — 꾸미기 자리가 없다(blockquote/callout/listItem 안의 paragraph/list) ──

const innerParagraphSchema = z.strictObject({
  type: z.literal("paragraph"),
  content: z.array(textSchema).optional(),
});

type InnerParagraphNode = z.infer<typeof innerParagraphSchema>;

interface ListItemNode {
  type: "listItem";
  content: [InnerParagraphNode, ...InnerListNode[]];
}
interface InnerBulletListNode {
  type: "bulletList";
  content: ListItemNode[];
}
interface InnerOrderedListNode {
  type: "orderedList";
  content: ListItemNode[];
}
type InnerListNode = InnerBulletListNode | InnerOrderedListNode;

/**
 * listItem ↔ 안쪽 list(bulletList/orderedList) 상호 재귀 — z.lazy로 순환을 끊는다.
 * 안쪽 리스트에는 attrs 자리가 없다(꾸미기는 doc.content 바로 아래 최상위 블록에만, 스티커 상한이
 * 안쪽 노드로 우회되지 않게 — decoration-schema).
 */
const listItemSchema: z.ZodType<ListItemNode> = z.lazy(() =>
  z.strictObject({
    type: z.literal("listItem"),
    content: z.tuple([innerParagraphSchema], innerListSchema),
  }),
);

const innerBulletListSchema: z.ZodType<InnerBulletListNode> = z.lazy(() =>
  z.strictObject({
    type: z.literal("bulletList"),
    content: z.array(listItemSchema).min(1),
  }),
);

const innerOrderedListSchema: z.ZodType<InnerOrderedListNode> = z.lazy(() =>
  z.strictObject({
    type: z.literal("orderedList"),
    content: z.array(listItemSchema).min(1),
  }),
);

const innerListSchema: z.ZodType<InnerListNode> = z.lazy(() =>
  z.union([innerBulletListSchema, innerOrderedListSchema]),
);

// ── 5. 최상위 블록 ─────────────────────────────────────────────────────

const paragraphSchema = z.strictObject({
  type: z.literal("paragraph"),
  attrs: textDecorationAttrsSchema.optional(),
  content: z.array(textSchema).optional(),
});

const headingSchema = z.strictObject({
  type: z.literal("heading"),
  attrs: headingAttrsSchema,
  content: z.array(textSchema).optional(),
});

const blockquoteSchema = z.strictObject({
  type: z.literal("blockquote"),
  attrs: textDecorationAttrsSchema.optional(),
  content: z.array(innerParagraphSchema).min(1),
});

const codeBlockSchema = z.strictObject({
  type: z.literal("codeBlock"),
  attrs: codeBlockAttrsSchema.optional(),
  content: z.array(codeBlockTextSchema).optional(),
});

const horizontalRuleSchema = z.strictObject({
  type: z.literal("horizontalRule"),
  attrs: motionOnlyAttrsSchema.optional(),
});

const imageSchema = z.strictObject({
  type: z.literal("image"),
  attrs: imageAttrsSchema,
});

const appScreenshotSchema = z.strictObject({
  type: z.literal("appScreenshot"),
  attrs: appScreenshotAttrsSchema,
});

/** doc.content에 바로 있을 때만 attrs(꾸미기)가 있다 — listItem/callout 안 리스트는 innerBulletList/innerOrderedList를 쓴다. */
const bulletListSchema = z.strictObject({
  type: z.literal("bulletList"),
  attrs: textDecorationAttrsSchema.optional(),
  content: z.array(listItemSchema).min(1),
});

const orderedListSchema = z.strictObject({
  type: z.literal("orderedList"),
  attrs: textDecorationAttrsSchema.optional(),
  content: z.array(listItemSchema).min(1),
});

const calloutSchema = z.strictObject({
  type: z.literal("callout"),
  attrs: calloutAttrsSchema,
  content: z
    .array(z.union([innerParagraphSchema, innerBulletListSchema, innerOrderedListSchema]))
    .min(1),
});

const topLevelBlockSchema = z.union([
  paragraphSchema,
  headingSchema,
  bulletListSchema,
  orderedListSchema,
  blockquoteSchema,
  codeBlockSchema,
  horizontalRuleSchema,
  imageSchema,
  calloutSchema,
  appScreenshotSchema,
]);

// ── 6. doc 루트 + 스티커 합계 12개 refine(보호 대상) ───────────────────────

/** 안쪽 노드에는 attrs 자리가 없으므로 최상위 블록(doc.content)만 합산하면 충분하다. */
function countStickers(blocks: readonly unknown[]): number {
  return blocks.reduce((sum: number, block) => {
    const attrs = (block as { attrs?: { stickers?: unknown[] } }).attrs;
    const stickers = attrs?.stickers;
    return sum + (Array.isArray(stickers) ? stickers.length : 0);
  }, 0);
}

export const docSchema = z
  .strictObject({
    type: z.literal("doc"),
    content: z.array(topLevelBlockSchema).min(1),
  })
  .superRefine((doc, ctx) => {
    if (countStickers(doc.content) > MAX_STICKERS_PER_DOC) {
      ctx.addIssue({
        code: "custom",
        message: `스티커는 글 하나에 최대 ${MAX_STICKERS_PER_DOC}개까지 쓸 수 있다`,
        path: ["content"],
      });
    }
  });

// ── 7. 타입 ────────────────────────────────────────────────────────────

export type Mark = z.infer<typeof markSchema>;
export type TextNode = z.infer<typeof textSchema>;
export type Sticker = z.infer<typeof stickerSchema>;
/**
 * 꾸미기 속성의 합집합 타입 — 실제 노드는 각자의 좁은 attrs 스키마를 쓴다(font는 글자 블록만,
 * width는 image/appScreenshot만). 상수·스키마에서 파생하므로 FONTS/MOTIONS/범위가 바뀌면 따라온다.
 */
export type DecorationAttrs = Partial<{
  font: (typeof FONTS)[number];
  motion: (typeof MOTIONS)[number];
  width: z.infer<typeof widthSchema>;
  stickers: Sticker[];
}>;
export type Block = z.infer<typeof topLevelBlockSchema>;
export type Doc = z.infer<typeof docSchema>;
