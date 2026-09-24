import type {
  FONTS,
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
  TEXT_SIZES,
  TEXT_WEIGHTS,
} from "@blog-editor/content-schema";
import type { ToolbarMark } from "@blog-editor/editor-core";

/** 글자 서식 도구줄의 사용자 문장 — 한 곳에서 고친다(spec: editor-text-style). */
export const textToolbarMessages = {
  label: "글자 서식",
  link: "링크",
  font: "글꼴",
  weight: "두께",
  size: "크기",
  color: "글자색",
  highlight: "배경색",
  mixed: "여러 값",
  none: "기본",
  sizeNormal: "보통",
  clearColor: "색 지우기",
  hexLabel: "직접 입력(#RRGGBB)",
  hexApply: "적용",
  hexInvalid: "#과 16진수 6자리로 적어 주세요. 예: #3366aa",
  hardToRead: "읽기 어려울 수 있어요 — 바탕과 대비가 4.5:1보다 낮아요.",
  mixedFontWeight: "글꼴이 섞여 있어 두께를 고를 수 없어요.",
  noWeight: (font: string) => `${font}에는 고를 두께가 없어요.`,
} as const;

export const MARK_LABELS: Record<ToolbarMark, string> = {
  bold: "굵게",
  italic: "기울임",
  underline: "밑줄",
  strike: "취소선",
  code: "코드",
};

export const FONT_LABELS: Record<(typeof FONTS)[number], string> = {
  pretendard: "Pretendard",
  jua: "Jua",
  gaegu: "Gaegu",
};

export const WEIGHT_LABELS: Record<(typeof TEXT_WEIGHTS)[number], string> = {
  light: "가늘게",
  medium: "중간",
  heavy: "아주 굵게",
};

export const SIZE_LABELS: Record<(typeof TEXT_SIZES)[number], string> = {
  sm: "작게",
  lg: "크게",
  xl: "더 크게",
  "2xl": "아주 크게",
};

export const TEXT_COLOR_LABELS: Record<(typeof TEXT_COLORS)[number], string> = {
  muted: "흐리게",
  brand: "브랜드",
  green: "초록",
  red: "빨강",
};

export const HIGHLIGHT_LABELS: Record<(typeof HIGHLIGHT_COLORS)[number], string> = {
  apricot: "살구",
  mint: "민트",
  yellow: "노랑",
};
