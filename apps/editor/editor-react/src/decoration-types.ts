import type { ALIGNS, FONTS, MOTIONS, STICKER_IDS } from "@blog-editor/content-schema";

/** 꾸미기 패널의 공개 타입 — spec: decoration-panel */

export type Font = (typeof FONTS)[number];
export type Motion = (typeof MOTIONS)[number];
export type StickerId = (typeof STICKER_IDS)[number];
export type Align = (typeof ALIGNS)[number];

export type Availability = { enabled: true } | { enabled: false; reason: string };

export interface DecorationPanelState {
  /** 선택의 첫 최상위 블록 이름. 여러 블록이면 "블록 N개", 대상이 없으면 null */
  target: { label: string } | null;
  font: { value: Font | null; availability: Availability };
  motion: { value: Motion | null; availability: Availability };
  /** 첫 대상 블록의 지금 모양(저장값이 없으면 그 블록의 기본 모양). 정렬 자리가 없으면 null */
  align: { value: Align | null; availability: Availability };
  sticker: { count: number; availability: Availability };
  /** 그림 · 앱 스크린샷을 노드로 골랐을 때만 — 폭 도구줄의 대상 */
  width: { pos: number; value: number } | null;
}
