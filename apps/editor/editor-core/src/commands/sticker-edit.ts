import type { Node } from "@tiptap/pm/model";
import type { Command } from "@tiptap/pm/state";
import type { Mappable } from "@tiptap/pm/transform";
import { STICKER_RANGES } from "@blog-editor/content-schema";
import type { Sticker } from "@blog-editor/content-schema";
import { removeSticker, updateSticker } from "./decoration";
import type { BlockRect, StickerPatch, StickerTarget } from "./decoration";

/**
 * 고른 스티커 조작 — spec: editor-sticker-edit, sticker-drag design.md.
 * 스티커에는 id가 없어 (블록 시작 위치, 순번)으로 가리킨다(editor-decoration design.md 2).
 */

export interface StickerRef {
  blockPos: number;
  index: number;
}

const NUDGE = 1;
const ROTATE_STEP = 15;
const FULL_TURN = 360;
/** 블록 사이 틈(본문 22px)보다 조금 넓게 — 틈에 놓아도 가까운 블록 끝에 붙는다(design.md 3) */
const MAX_SNAP_PX = 24;
const PERCENT = 100;

/** ±180 밖이면 반대쪽으로 감는다 — 회전은 원이라 범위 끝에서 멈출 이유가 없다(design.md 4) */
export function wrapRotation(degrees: number): number {
  const { min, max } = STICKER_RANGES.rotate;
  if (degrees > max) return degrees - FULL_TURN;
  if (degrees < min) return degrees + FULL_TURN;
  return degrees;
}

type KeyPatch = (sticker: Sticker) => StickerPatch;

const KEY_PATCHES: Record<string, KeyPatch> = {
  ArrowLeft: ({ x }) => ({ x: x - NUDGE }),
  ArrowRight: ({ x }) => ({ x: x + NUDGE }),
  ArrowUp: ({ y }) => ({ y: y - NUDGE }),
  ArrowDown: ({ y }) => ({ y: y + NUDGE }),
  "+": ({ size }) => ({ size: size + NUDGE }),
  "=": ({ size }) => ({ size: size + NUDGE }),
  "-": ({ size }) => ({ size: size - NUDGE }),
  "[": ({ rotate }) => ({ rotate: wrapRotation(rotate - ROTATE_STEP) }),
  "]": ({ rotate }) => ({ rotate: wrapRotation(rotate + ROTATE_STEP) }),
};

const REMOVE_KEYS = new Set(["Delete", "Backspace"]);

/**
 * 키 하나 → 스티커 커맨드. 모르는 키면 null이라 부르는 쪽이 기본 동작에 넘긴다.
 * 범위 밖으로 나가는 키는 updateSticker가 false다(자르지 않는다).
 */
export function stickerKeyCommand({ blockPos, index }: StickerRef, key: string): Command | null {
  if (REMOVE_KEYS.has(key)) return removeSticker(blockPos, index);
  const patchOf = KEY_PATCHES[key];
  if (patchOf === undefined) return null;
  return (state, dispatch) => {
    const stickers = state.doc.nodeAt(blockPos)?.attrs.stickers as Sticker[] | null | undefined;
    const current = stickers?.[index];
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
  if (mapped.deleted || mapped.pos >= doc.content.size) return null;
  if (doc.resolve(mapped.pos).depth !== 0) return null;
  const stickers = doc.nodeAt(mapped.pos)?.attrs.stickers as unknown[] | null | undefined;
  return stickers?.[ref.index] === undefined ? null : { blockPos: mapped.pos, index: ref.index };
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
 * 놓은 스티커 중심(px) → 붙을 블록과 % 좌표(design.md 3). 좌표 정의는 placeOnNearestBlock과 같다.
 * (스냅 거리, 블록까지 거리, 문서 순서)로 고르고, 24px보다 멀리 옮겨야 하면 놓을 수 없는 자리라 null이다.
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
  return best !== null && best.snap <= MAX_SNAP_PX ? best.target : null;
}
