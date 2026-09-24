import type { Command } from "@tiptap/pm/state";
import type { StickerRef } from "@blog-editor/editor-core";

/**
 * 스티커 오버레이의 타입 — sticker-drag design.md.
 * 좌표는 모두 **레이어 기준 px**다. 잴 때 바로 바꿔 두므로 스크롤해도 어긋나지 않는다.
 */

export interface LayerPoint {
  x: number;
  y: number;
}

export interface StickerBox {
  key: string;
  blockPos: number;
  index: number;
  id: string;
  /** 에디터가 그린 이미지 주소 — 유령도 같은 것을 쓴다 */
  src: string;
  size: number;
  rotate: number;
  nodeName: string;
  /** 회전을 뺀 그려진 크기(px) — 테두리 · 조절점을 스티커와 함께 돌리려고 */
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  /** 스티커가 붙은 블록 폭(px) — 크기 %를 px로 바꿀 때 */
  blockWidth: number;
}

export type GestureKind = "move" | "resize" | "rotate";

export interface Gesture {
  kind: GestureKind;
  box: StickerBox;
  /** 이 포인터만 따라간다 — 다른 손가락 · 펜은 무시 */
  pointerId: number;
  start: LayerPoint;
  current: LayerPoint;
}

/** 끄는 동안 보여 줄 유령과 놓았을 때 실행할 커맨드 */
export interface Preview {
  centerX: number;
  centerY: number;
  width: number;
  rotate: number;
  /** 꼬리표 — 어디에 붙는지, 또는 놓을 수 없는 이유 */
  label: string;
  /** null이면 놓을 수 없는 자리 */
  command: Command | null;
  /** 놓은 뒤 고를 스티커 */
  next: StickerRef | null;
}
