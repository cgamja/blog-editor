/** 꾸미기 커맨드의 공개 타입 — spec: editor-decoration. 커맨드는 decoration.ts */

export interface StickerPlacement {
  /** 스티커가 붙을 최상위 블록의 시작 위치 */
  blockPos: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
}

/** 옮길 자리 — 회전은 원래 스티커의 것을 쓴다 */
export type StickerTarget = Omit<StickerPlacement, "rotate">;

export type StickerPatch = Partial<Omit<StickerPlacement, "blockPos">>;

/** 블록 사각형(px) — 측정은 UI가 하고 커맨드 쪽은 숫자만 본다 */
export interface BlockRect {
  pos: number;
  left: number;
  top: number;
  width: number;
  height: number;
}
