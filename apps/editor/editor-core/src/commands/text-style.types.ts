import type { TextStyleAttrs } from "@blog-editor/content-schema";

/** patch 속성 — 값은 걸기, null은 지우기, 없음은 그대로 */
export type TextStylePatch = { [Key in keyof TextStyleAttrs]?: TextStyleAttrs[Key] | null };

/** 고른 범위에 섞인 값 */
export const MIXED: unique symbol = Symbol("mixed");

/** 속성 하나의 요약 — 값 하나 · 없음(null) · 여러 값(MIXED) */
export type SummaryValue<T> = T | null | typeof MIXED;

/** 도구줄이 켜짐 상태를 보이는 마크 */
export const TOOLBAR_MARKS = ["bold", "italic", "underline", "strike", "code"] as const;
export type ToolbarMark = (typeof TOOLBAR_MARKS)[number];

export interface TextStyleSummary {
  /** 고른 글자가 있고 그 중 스타일을 받을 수 있는 글자가 있다 */
  canStyle: boolean;
  font: SummaryValue<NonNullable<TextStyleAttrs["font"]>>;
  weight: SummaryValue<NonNullable<TextStyleAttrs["weight"]>>;
  size: SummaryValue<NonNullable<TextStyleAttrs["size"]>>;
  color: SummaryValue<string>;
  highlight: SummaryValue<string>;
  /** 고른 글자 모두에 걸렸나 */
  marks: Record<ToolbarMark, boolean>;
}

/** 마지막에 건 색 — ⌘⇧H가 다시 건다 */
export interface LastColor {
  key: "color" | "highlight";
  value: string;
}
