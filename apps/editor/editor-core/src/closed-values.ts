import {
  ALIGNS,
  BRIEF_MAX_LENGTH,
  CALLOUT_TONES,
  CODE_LANGUAGE_PATTERN,
  DEFAULT_ORDERED_LIST_START,
  FONTS,
  HEADING_LEVELS,
  HEX_COLOR_PATTERN,
  HIGHLIGHT_COLORS,
  MOTIONS,
  NATURAL_SIZE_RANGE,
  ORDERED_LIST_START_RANGE,
  SPACES,
  PHOTO_RATIOS,
  PROMPT_MAX_LENGTH,
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
import type { Sticker } from "@blog-editor/content-schema";

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
export const spaceOrNull = oneOf(SPACES);
export const photoRatioOrNull = oneOf(PHOTO_RATIOS);

/**
 * 사진 설명(adr-033) — 한 줄로 모으고 앞뒤 공백을 뗀 뒤 한도 안이면 그 글, 비었거나 넘으면 null.
 * 붙여넣은 `data-brief`와 설명 입력칸이 같은 규칙을 쓴다(content-schema briefSchema와 같은 모양).
 */
export function briefOrNull(value: unknown): string | null {
  return oneLineOrNull(value, BRIEF_MAX_LENGTH);
}

/** 이미지 프롬프트(adr-043) — 설명과 같은 규칙(한 줄 · 앞뒤 공백 없음), 한도만 다르다(content-schema promptSchema) */
export function promptOrNull(value: unknown): string | null {
  return oneLineOrNull(value, PROMPT_MAX_LENGTH);
}

function oneLineOrNull(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const line = value.replace(/[\r\n]+/g, " ").trim();
  return line === "" || line.length > maxLength ? null : line;
}
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

/** 번호 목록 번호 — 범위 밖 · 정수 아님은 없음. 기본(1)도 번호로 남는다 */
export const orderedListNumberOrNull = (value: unknown): number | null =>
  intInRange(value, ORDERED_LIST_START_RANGE);

/** 번호 목록 시작 번호 — 범위 밖 · 정수 아님은 없음, 기본(1)도 없음(정규형과 같은 모양) */
export function orderedListStartOrNull(value: unknown): number | null {
  const start = orderedListNumberOrNull(value);
  return start === DEFAULT_ORDERED_LIST_START ? null : start;
}

/** 에디터 HTML `data-checked` 값 → 할 일 체크 여부(adr-036). 두 값 밖이면 보통 항목 */
const TASK_CHECKED_VALUES: Readonly<Record<string, boolean>> = { true: true, false: false };
export const taskCheckedOrNull = (value: unknown): boolean | null =>
  typeof value === "string" && Object.hasOwn(TASK_CHECKED_VALUES, value)
    ? TASK_CHECKED_VALUES[value]!
    : null;

export const stickerIdOrNull = oneOf(STICKER_IDS);

/** 스티커 좌표 한 칸(x · y · size · rotate) — 범위 밖 · 정수 아님은 없는 것 */
export const stickerFieldOrNull = (
  key: keyof typeof STICKER_RANGES,
  value: unknown,
): number | null => intInRange(value, STICKER_RANGES[key]);

/** 스티커 하나 — 닫힌 id와 좌표 범위 안이면 그 값, 한 칸이라도 밖이면 null(자르지 않는다) */
export function stickerOrNull(value: unknown): Sticker | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, x, y, size, rotate } = value as Record<string, unknown>;
  const sticker = {
    id: stickerIdOrNull(id),
    x: stickerFieldOrNull("x", x),
    y: stickerFieldOrNull("y", y),
    size: stickerFieldOrNull("size", size),
    rotate: stickerFieldOrNull("rotate", rotate),
  };
  return Object.values(sticker).every((field) => field !== null) ? (sticker as Sticker) : null;
}

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
