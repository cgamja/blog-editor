import type { Font, Motion, StickerId } from "./decoration-types";

/**
 * 꾸미기 패널의 선택지 — 값은 content-schema 닫힌 집합(adr-008)과 하나씩 짝이 맞는다(테스트가 본다).
 * 이름표만 여기서 정한다. spec: decoration-panel
 */

export const FONT_OPTIONS: ReadonlyArray<{ value: Font; label: string }> = [
  { value: "pretendard", label: "Pretendard" },
  { value: "jua", label: "Jua" },
  { value: "gaegu", label: "Gaegu" },
];

/** 결정 2026-09-24: 스키마 5종 + 없음(디자인의 「살랑살랑 흔들리기」는 뺀다) */
export const MOTION_OPTIONS: ReadonlyArray<{ value: Motion | null; label: string }> = [
  { value: null, label: "없음" },
  { value: "pop", label: "톡 튀어나오기" },
  { value: "fade-in", label: "서서히 나타나기" },
  { value: "fade-up", label: "아래에서 올라오기" },
  { value: "slide-left", label: "왼쪽에서 들어오기" },
  { value: "slide-right", label: "오른쪽에서 들어오기" },
];

export const STICKER_OPTIONS: ReadonlyArray<{ id: StickerId; label: string }> = [
  { id: "star-coral", label: "코랄 별" },
  { id: "star-mint", label: "민트 별" },
  { id: "heart", label: "하트" },
  { id: "cloud", label: "구름" },
  { id: "bottle", label: "젖병" },
  { id: "rattle", label: "딸랑이" },
  { id: "pacifier", label: "쪽쪽이" },
  { id: "foot-coral", label: "코랄 발자국" },
  { id: "foot-mint", label: "민트 발자국" },
];

/** 결정 2026-09-24: 작게 50 · 보통 70 · 꽉 차게 100 */
export const WIDTH_PRESETS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 50, label: "작게" },
  { value: 70, label: "보통" },
  { value: 100, label: "꽉 차게" },
];

/** 에디터 노드 이름 → 사람이 읽는 블록 이름 */
export const BLOCK_LABELS: Readonly<Record<string, string>> = {
  paragraph: "문단",
  heading: "제목",
  bulletList: "목록",
  orderedList: "번호 목록",
  blockquote: "인용",
  codeBlock: "코드 블록",
  horizontalRule: "구분선",
  image: "사진",
  appScreenshot: "앱 스크린샷",
  callout: "콜아웃",
};
