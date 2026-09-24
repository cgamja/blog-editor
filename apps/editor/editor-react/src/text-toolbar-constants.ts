import type { HIGHLIGHT_COLORS, TEXT_COLORS } from "@blog-editor/content-schema";

/**
 * 프리셋 색 이름의 실제 값 — design/tokens.json을 옮겼다(ADR-020). 대비 경고(text-toolbar design.md 6)와
 * 도구줄 칩 미리보기가 쓴다. 본문에 그려지는 색은 content-render post.css가 같은 토큰으로 정한다.
 */
export const TEXT_COLOR_HEX: Record<(typeof TEXT_COLORS)[number], string> = {
  muted: "#7b6b64", // ink-soft
  brand: "#b0552f", // brand-ink
  green: "#2a4f41", // accent-ink
  red: "#a3341f", // danger-ink
};

export const HIGHLIGHT_HEX: Record<(typeof HIGHLIGHT_COLORS)[number], string> = {
  apricot: "#ffede6", // brand-soft
  mint: "#eaf5ee", // accent-soft
  yellow: "#fff1cc", // postit
};

/** 색이 없을 때 대비를 재는 기준 — 본문 글자(ink)와 종이(surface) */
export const DEFAULT_TEXT_HEX = "#3a2b26";
export const PAPER_HEX = "#ffffff";

/** WCAG 2 본문 글자 최소 대비(AA) — https://www.w3.org/TR/WCAG22/#contrast-minimum */
export const READABLE_CONTRAST = 4.5;
