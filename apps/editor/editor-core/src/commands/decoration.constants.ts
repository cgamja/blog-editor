import type { StickerPlacement } from "./decoration.types";

/** 디자인 69:2의 코랄 별 자리 — 블록 오른쪽 위 모서리, 약 88px / 600px(editor-decoration design.md 2) */
export const DEFAULT_COORDINATES: Omit<StickerPlacement, "blockPos"> = {
  x: 95,
  y: 5,
  size: 15,
  rotate: 0,
};
