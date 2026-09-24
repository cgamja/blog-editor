import type { StickerPlacement } from "./decoration.types";

/**
 * 디자인 69:2의 코랄 별 자리 — 블록 오른쪽 위 모서리(editor-decoration design.md 2).
 * 크기는 블록 폭의 8% — 15%(88px / 600px)는 본문 폭에서 128px라 글자를 가렸다(이슈 #71, sticker-polish design.md 5).
 */
export const DEFAULT_COORDINATES: Omit<StickerPlacement, "blockPos"> = {
  x: 95,
  y: 5,
  size: 8,
  rotate: 0,
};
