import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import type { Align } from "./decoration-types";

const ALIGN_NAMES: Record<Align, string> = { left: "왼쪽", center: "가운데", right: "오른쪽" };

/** 꾸미기 패널 · 폭 도구줄이 사용자에게 보이는 문장 — 한 곳에서 고친다(spec: decoration-panel design.md 2) */
export const decorationMessages = {
  panelLabel: "꾸미기",
  fontLegend: "글씨체",
  fontSample: "가나다",
  stickerLegend: "스티커",
  motionLabel: "움직임",
  previewButton: "움직임 미리 보기",
  widthToolbarLabel: "사진 폭",
  noTarget: "꾸밀 블록을 먼저 고르세요",
  stickerLimit: `스티커는 글 하나에 ${String(MAX_STICKERS_PER_DOC)}개까지예요`,
  cannotHoldFont: (block: string) => `${block}에는 글씨체를 줄 수 없어요`,
  cannotHoldMotion: (block: string) => `${block}에는 움직임을 줄 수 없어요`,
  alignLegend: "정렬",
  cannotHoldAlign: (block: string) => `${block}에는 정렬을 줄 수 없어요`,
  alignName: (align: Align) => ALIGN_NAMES[align],
  alignButton: (label: string) => `${label} 정렬`,
  multipleBlocks: (count: number) => `블록 ${String(count)}개`,
  targetLine: (label: string | null) =>
    label === null ? "고른 블록 없음" : `고른 블록 · ${label}`,
  stickerHint: (count: number) =>
    `누르면 고른 블록 오른쪽 위에 붙어요(${String(count)}개 붙음). 가장 가까운 문단이나 사진에 붙어서, 폰에서도 그 옆에 그대로 있어요.`,
  motionHint: "움직임을 줄이도록 설정한 독자에게는 움직이지 않고 보여요.",
  previewReducedMotion: "움직임 줄이기 설정이 켜져 있어 미리 보기를 재생하지 않아요.",
  widthValue: (percent: number) => `가로 ${String(percent)}%`,
  stickerButton: (label: string) => `${label} 스티커 붙이기`,
} as const;
