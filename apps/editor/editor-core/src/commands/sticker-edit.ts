import type { Node } from "@tiptap/pm/model";
import type { Command } from "@tiptap/pm/state";
import type { Mappable } from "@tiptap/pm/transform";
import { STICKER_RANGES } from "@blog-editor/content-schema";
import type { Sticker } from "@blog-editor/content-schema";
import { removeSticker, updateSticker } from "./decoration";
import type { BlockRect, StickerPatch, StickerTarget } from "./decoration.types";
import { stickersIn } from "./sticker-query";

/**
 * 고른 스티커 조작 — spec: editor-sticker-edit, sticker-drag design.md.
 * 스티커에는 id가 없어 (블록 시작 위치, 순번)으로 가리킨다(editor-decoration design.md 2).
 */

export interface StickerRef {
  blockPos: number;
  index: number;
}

/** 방향키 한 번에 옮기는 거리 — 블록 폭 · 높이의 % */
const NUDGE_PERCENT = 1;
/** +/- 한 번에 바꾸는 크기 — 블록 폭의 % */
const RESIZE_STEP_PERCENT = 1;
const ROTATE_STEP_DEGREES = 15;
const FULL_TURN_DEGREES = 360;
const PERCENT = 100;

/** ±180 밖이면 반대쪽으로 감는다 — 회전은 원이라 범위 끝에서 멈출 이유가 없다(design.md 4) */
export function wrapRotation(degrees: number): number {
  const { min, max } = STICKER_RANGES.rotate;
  if (degrees > max) return degrees - FULL_TURN_DEGREES;
  if (degrees < min) return degrees + FULL_TURN_DEGREES;
  return degrees;
}

type KeyPatch = (sticker: Sticker) => StickerPatch;

const KEY_PATCHES: Record<string, KeyPatch> = {
  ArrowLeft: ({ x }) => ({ x: x - NUDGE_PERCENT }),
  ArrowRight: ({ x }) => ({ x: x + NUDGE_PERCENT }),
  ArrowUp: ({ y }) => ({ y: y - NUDGE_PERCENT }),
  ArrowDown: ({ y }) => ({ y: y + NUDGE_PERCENT }),
  "+": ({ size }) => ({ size: size + RESIZE_STEP_PERCENT }),
  "=": ({ size }) => ({ size: size + RESIZE_STEP_PERCENT }),
  "-": ({ size }) => ({ size: size - RESIZE_STEP_PERCENT }),
  "[": ({ rotate }) => ({ rotate: wrapRotation(rotate - ROTATE_STEP_DEGREES) }),
  "]": ({ rotate }) => ({ rotate: wrapRotation(rotate + ROTATE_STEP_DEGREES) }),
};

const REMOVE_KEYS = new Set(["Delete", "Backspace"]);

export const isStickerRemoveKey = (key: string): boolean => REMOVE_KEYS.has(key);

export interface KeyModifiers {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/**
 * 키 하나 → 스티커 커맨드. 모르는 키 · 보조키 조합(Cmd+- 확대, Cmd+[ 뒤로 등)이면 null이라
 * 부르는 쪽이 브라우저 기본 동작에 넘긴다. 범위 밖으로 나가는 키는 updateSticker가 false다(자르지 않는다).
 */
export function stickerKeyCommand(
  { blockPos, index }: StickerRef,
  key: string,
  { metaKey = false, ctrlKey = false, altKey = false }: KeyModifiers = {},
): Command | null {
  if (metaKey || ctrlKey || altKey) return null;
  if (isStickerRemoveKey(key)) return removeSticker(blockPos, index);
  const patchOf = KEY_PATCHES[key];
  if (patchOf === undefined) return null;
  return (state, dispatch) => {
    const current = stickersIn(state.doc, blockPos)[index];
    if (current === undefined) return false;
    return updateSticker(blockPos, index, patchOf(current))(state, dispatch);
  };
}

/**
 * 트랜잭션 뒤 참조를 옮긴다. assoc 1이라 블록 바로 앞에 들어온 내용 뒤로 따라간다.
 * 블록이 지워졌거나(옮기기도 지우고 넣는 것) 순번이 없으면 null(design.md 2).
 * https://prosemirror.net/docs/ref/#transform.Mappable.mapResult
 */
export function mapStickerRef(ref: StickerRef, mapping: Mappable, doc: Node): StickerRef | null {
  const mapped = mapping.mapResult(ref.blockPos, 1);
  if (mapped.deleted) return null;
  return stickersIn(doc, mapped.pos)[ref.index] === undefined
    ? null
    : { blockPos: mapped.pos, index: ref.index };
}

// ── 놓은 자리 → 블록 ──

interface Candidate {
  target: StickerTarget;
  snap: number;
  distance: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const toPercent = (value: number, whole: number) => Math.round((value / whole) * PERCENT) + 0; // + 0: -0을 0으로

/** 허용 사각형(블록 기준 −25~125%) 안으로 옮긴 점과 옮긴 거리 */
function candidateOn(
  block: BlockRect,
  point: { x: number; y: number },
  stickerWidth: number,
): Candidate | null {
  const size = toPercent(stickerWidth, block.width);
  if (size < STICKER_RANGES.size.min || size > STICKER_RANGES.size.max) return null;
  const allowed = (range: { min: number; max: number }, start: number, length: number) => ({
    min: start + (range.min / PERCENT) * length,
    max: start + (range.max / PERCENT) * length,
  });
  const xs = allowed(STICKER_RANGES.x, block.left, block.width);
  const ys = allowed(STICKER_RANGES.y, block.top, block.height);
  const x = clamp(point.x, xs.min, xs.max);
  const y = clamp(point.y, ys.min, ys.max);
  const dx = Math.max(block.left - point.x, 0, point.x - (block.left + block.width));
  const dy = Math.max(block.top - point.y, 0, point.y - (block.top + block.height));
  return {
    target: {
      blockPos: block.pos,
      x: toPercent(x - block.left, block.width),
      y: toPercent(y - block.top, block.height),
      size,
    },
    snap: Math.hypot(point.x - x, point.y - y),
    distance: Math.hypot(dx, dy),
  };
}

/**
 * 놓은 스티커 중심(px) → 붙을 블록과 % 좌표(design.md 3). x · y는 중심의 블록 폭 · 높이 기준 %, size는 폭 기준 %(post.css).
 * (스냅 거리, 블록까지 거리, 문서 순서)로 고른다. 스냅 거리에 한도가 없다 — 한도가 있으면 여백에 놓은 스티커가
 * 거절돼 "잘 안 옮겨진다"(sticker-polish design.md 1 · 2). null은 크기가 맞는 블록이 없을 때뿐이다.
 */
export function placeStickerNear(
  blocks: readonly BlockRect[],
  point: { x: number; y: number },
  stickerWidth: number,
): StickerTarget | null {
  let best: Candidate | null = null;
  for (const block of blocks) {
    if (block.width <= 0 || block.height <= 0) continue;
    const candidate = candidateOn(block, point, stickerWidth);
    if (candidate === null) continue;
    const better =
      best === null ||
      candidate.snap < best.snap ||
      (candidate.snap === best.snap && candidate.distance < best.distance);
    if (better) best = candidate;
  }
  return best?.target ?? null;
}
