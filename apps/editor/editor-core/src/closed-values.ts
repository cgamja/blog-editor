import {
  ALIGNS,
  CALLOUT_TONES,
  CODE_LANGUAGE_PATTERN,
  FONTS,
  HEADING_LEVELS,
  HEX_COLOR_PATTERN,
  HIGHLIGHT_COLORS,
  MOTIONS,
  NATURAL_SIZE_RANGE,
  STICKER_IDS,
  STICKER_RANGES,
  TEXT_COLORS,
  TEXT_SIZES,
  TEXT_WEIGHTS,
  WIDTH_RANGE,
  hrefSchema,
  imagePathSchema,
  naturalSizeOf,
} from "@blog-editor/content-schema";

/**
 * 밖에서 들어온 값(붙여넣은 HTML 속성 · 붙여넣은 조각의 attrs)을 content-schema의 닫힌 집합으로 거른다.
 * 규칙은 여기서 새로 적지 않고 content-schema 상수 · 스키마를 그대로 쓴다 — 어기면 null(없음).
 */

function oneOf<T extends string>(values: readonly T[]) {
  return (value: unknown): T | null =>
    typeof value === "string" && (values as readonly string[]).includes(value)
      ? (value as T)
      : null;
}

export const fontOrNull = oneOf(FONTS);
export const motionOrNull = oneOf(MOTIONS);
export const toneOrNull = oneOf(CALLOUT_TONES);
export const alignOrNull = oneOf(ALIGNS);
export const textWeightOrNull = oneOf(TEXT_WEIGHTS);
export const textSizeOrNull = oneOf(TEXT_SIZES);
export const textColorPresetOrNull = oneOf(TEXT_COLORS);
export const highlightPresetOrNull = oneOf(HIGHLIGHT_COLORS);

/** 직접 입력 색 — 스키마 정규형(소문자 6자리)만. 대문자 · 3자리는 없는 것으로 본다. */
export const hexColorOrNull = (value: unknown): string | null =>
  typeof value === "string" && HEX_COLOR_PATTERN.test(value) ? value : null;

const DIGITS = /^\d+$/;

function intInRange(value: unknown, range: { min: number; max: number }): number | null {
  const number =
    typeof value === "string" && DIGITS.test(value.trim()) ? Number(value.trim()) : value;
  return typeof number === "number" &&
    Number.isInteger(number) &&
    number >= range.min &&
    number <= range.max
    ? number
    : null;
}

export const widthOrNull = (value: unknown): number | null => intInRange(value, WIDTH_RANGE);

export const stickerIdOrNull = oneOf(STICKER_IDS);

/** 스티커 좌표 한 칸(x · y · size · rotate) — 범위 밖 · 정수 아님은 없는 것 */
export const stickerFieldOrNull = (
  key: keyof typeof STICKER_RANGES,
  value: unknown,
): number | null => intInRange(value, STICKER_RANGES[key]);

/** 원본 크기 한 변 — 범위 밖 · 숫자 아님은 없는 것. ProseMirror의 null도 여기서 한 번만 undefined로 바꾼다. */
const naturalSide = (value: unknown): number | undefined =>
  intInRange(value, NATURAL_SIZE_RANGE) ?? undefined;

/** 원본 크기 — 여기서는 범위와 문자열만 보고, 짝 판정은 content-schema naturalSizeOf 한 곳에 맡긴다. */
export const naturalSizeFrom = (width: unknown, height: unknown) =>
  naturalSizeOf({ naturalWidth: naturalSide(width), naturalHeight: naturalSide(height) });

export const languageOrNull = (value: unknown): string | null =>
  typeof value === "string" && CODE_LANGUAGE_PATTERN.test(value) ? value : null;

export const imagePathOrNull = (value: unknown): string | null =>
  imagePathSchema.safeParse(value).success ? (value as string) : null;

export const hrefOrNull = (value: unknown): string | null =>
  hrefSchema.safeParse(value).success ? (value as string) : null;

const MIN_LEVEL = Math.min(...HEADING_LEVELS);
const MAX_LEVEL = Math.max(...HEADING_LEVELS);

/** 허용 범위 밖 제목 태그는 가까운 허용 수준으로 — h1 → 2, h4~h6 → 3(design.md 3). */
export function headingLevelOf(tagLevel: number): (typeof HEADING_LEVELS)[number] {
  return Math.min(Math.max(tagLevel, MIN_LEVEL), MAX_LEVEL) as (typeof HEADING_LEVELS)[number];
}
