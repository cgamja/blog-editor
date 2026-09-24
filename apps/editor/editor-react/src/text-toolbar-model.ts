import { DEFAULT_TEXT_FONT, HEX_COLOR_PATTERN, WEIGHTS_BY_FONT } from "@blog-editor/content-schema";
import { MIXED, type SummaryValue, type TextStyleSummary } from "@blog-editor/editor-core";
import {
  DEFAULT_TEXT_HEX,
  HIGHLIGHT_HEX,
  PAPER_HEX,
  READABLE_CONTRAST,
  TEXT_COLOR_HEX,
} from "./text-toolbar-constants";
import { FONT_LABELS, textToolbarMessages } from "./text-toolbar-messages";
import type { ToolbarVisibility } from "./text-toolbar-types";

/** 글자 서식 도구줄의 순수 계산 — spec: editor-text-style, text-toolbar design.md 6 · 7. */

export interface Placement {
  top: number;
  below: boolean;
}

export interface WeightOptions {
  weights: readonly string[];
  /** 고를 두께가 없는 이유 — 있으면 두께 고르기를 막는다 */
  reason: string | null;
}

// WCAG 2 상대 휘도의 sRGB 상수 — https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
const CHANNEL_MAX = 255;
const SRGB_LINEAR_KNEE = 0.04045;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA = 2.4;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const LUMINANCE_OFFSET = 0.05;
/** #rrggbb에서 빨강 · 초록 · 파랑 두 자리가 시작하는 자리 */
const HEX_CHANNEL_STARTS = [1, 3, 5] as const;
const HEX_CHANNEL_LENGTH = 2;
const HEX_RADIX = 16;

const channelToLinear = (channel: number) => {
  const srgb = channel / CHANNEL_MAX;
  return srgb <= SRGB_LINEAR_KNEE
    ? srgb / SRGB_LINEAR_SLOPE
    : ((srgb + SRGB_GAMMA_OFFSET) / (1 + SRGB_GAMMA_OFFSET)) ** SRGB_GAMMA;
};

function luminance(hex: string): number {
  return HEX_CHANNEL_STARTS.reduce((sum, start, index) => {
    const channel = Number.parseInt(hex.slice(start, start + HEX_CHANNEL_LENGTH), HEX_RADIX);
    return sum + LUMINANCE_WEIGHTS[index]! * channelToLinear(channel);
  }, 0);
}

/** 두 색(#rrggbb)의 WCAG 대비 — 1에서 21 사이 */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + LUMINANCE_OFFSET) / (darker + LUMINANCE_OFFSET);
}

const hexOf = (value: string, presets: Record<string, string>): string | undefined =>
  value.startsWith("#") ? value : presets[value];

/** 글자색(없으면 본문 잉크)과 바탕(배경색, 없으면 종이)의 대비가 READABLE_CONTRAST 미만인가 — 막지는 않는다 */
export function isHardToRead(style: { color?: string | null; highlight?: string | null }): boolean {
  const foreground = (style.color && hexOf(style.color, TEXT_COLOR_HEX)) || DEFAULT_TEXT_HEX;
  const background = (style.highlight && hexOf(style.highlight, HIGHLIGHT_HEX)) || PAPER_HEX;
  return contrastRatio(foreground, background) < READABLE_CONTRAST;
}

/** `#` 직접 입력을 스키마 정규형(#rrggbb, 소문자)으로 — 6자리 16진이 아니면 null */
export function normalizeHexInput(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX_COLOR_PATTERN.test(hex) ? hex : null;
}

/**
 * 선택 위에 틈을 두고, 보이는 영역 위쪽(boundaryTop, 기본 0)까지 자리가 없으면 선택 아래.
 * 좌표는 모두 기준 틀 안 — 보이는 영역은 틀보다 위에서 시작할 수 있어 boundaryTop이 음수일 수 있다.
 */
export function toolbarPlacement(box: {
  selectionTop: number;
  selectionBottom: number;
  toolbarHeight: number;
  gap: number;
  boundaryTop?: number;
}): Placement {
  const above = box.selectionTop - box.gap - box.toolbarHeight;
  return above >= (box.boundaryTop ?? 0)
    ? { top: above, below: false }
    : { top: box.selectionBottom + box.gap, below: true };
}

/** 요약된 글꼴(없으면 본문 기본)에 있는 두께 — 섞였거나 없으면 이유와 함께 비운다(ADR-020) */
export function weightOptionsFor(font: TextStyleSummary["font"]): WeightOptions {
  if (font === MIXED) return { weights: [], reason: textToolbarMessages.mixedFontWeight };
  const effective = font ?? DEFAULT_TEXT_FONT;
  const weights = WEIGHTS_BY_FONT[effective];
  return weights.length > 0
    ? { weights, reason: null }
    : { weights: [], reason: textToolbarMessages.noWeight(FONT_LABELS[effective]) };
}

/**
 * 도구줄을 띄울지 — 글자 선택 · 전체 선택(⌘A)에서, 조합 중 · 편집 불가 · 포커스 없음이 아니고,
 * 마우스로 끌어 고르는 중이 아닐 때(끌기를 마친 뒤에 뜬다 — Notion과 같다)
 */
export function shouldShowToolbar(state: ToolbarVisibility): boolean {
  const selectsText = state.selection === "text" || state.selection === "all";
  return (
    state.canStyle &&
    selectsText &&
    !state.composing &&
    state.editable &&
    state.focused &&
    !state.pointerSelecting
  );
}

/** 도구줄 버튼에 보일 지금 값의 이름 — 여러 값 · 기본(없음) · 이름표(없으면 값 그대로, 직접 입력 색) */
export function summaryLabel(
  value: SummaryValue<string>,
  labels: Readonly<Record<string, string>>,
) {
  if (value === MIXED) return textToolbarMessages.mixed;
  if (value === null) return textToolbarMessages.none;
  return labels[value] ?? value;
}
