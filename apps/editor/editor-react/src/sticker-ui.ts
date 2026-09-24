import { STICKER_IDS, STICKER_RANGES } from "@blog-editor/content-schema";
import { wrapRotation } from "@blog-editor/editor-core";

/**
 * 스티커 오버레이의 순수 계산 — spec: editor-sticker-layer, sticker-drag design.md.
 * DOM을 모른다(node 환경 테스트). 사용자 문장은 sticker-messages.
 */

export type StickerId = (typeof STICKER_IDS)[number];

export const isStickerId = (value: string): value is StickerId =>
  (STICKER_IDS as readonly string[]).includes(value);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * 조절점을 끈 거리 비율만큼 크기를 바꾼다. 손이 범위 밖으로 가도 5~50에 모은다 —
 * 끄는 동안 보이는 유령이 곧 저장될 값이다(design.md 3).
 */
export function resizedSize(start: number, startDistance: number, distance: number): number {
  const { min, max } = STICKER_RANGES.size;
  if (startDistance <= 0) return start;
  return clamp(Math.round((start * distance) / startDistance), min, max);
}

const DEGREES_PER_RADIAN = 180 / Math.PI;

/** 중심 기준 각도가 바뀐 만큼 돌린다. ±180에서 감긴다 */
export function rotatedAngle(start: number, startRadians: number, radians: number): number {
  return wrapRotation(Math.round(start + (radians - startRadians) * DEGREES_PER_RADIAN)) + 0; // + 0: -0을 0으로
}

// ── 패널 격자 → 에디터 끌어 오기(HTML5 drag) ──

/** 이 앱만 읽는 형식 — 다른 곳(메모장 등)에 놓아도 글자가 들어가지 않는다 */
export const STICKER_DRAG_TYPE = "application/x-blog-editor-sticker";

/** DataTransfer에서 쓰는 부분만 */
export interface StickerDragData {
  readonly types: readonly string[];
  getData(type: string): string;
  setData(type: string, value: string): void;
}

export function writeStickerDrag(data: StickerDragData, id: StickerId): void {
  data.setData(STICKER_DRAG_TYPE, id);
}

/** 우리 형식이 아니거나 모르는 id면 null — 밖에서 온 끌기는 ProseMirror 기본 처리에 넘긴다 */
export function readStickerDrag(data: StickerDragData): StickerId | null {
  if (!data.types.includes(STICKER_DRAG_TYPE)) return null;
  const id = data.getData(STICKER_DRAG_TYPE);
  return isStickerId(id) ? id : null;
}
