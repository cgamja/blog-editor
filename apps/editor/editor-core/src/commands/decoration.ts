import type { Node } from "@tiptap/pm/model";
import { AllSelection } from "@tiptap/pm/state";
import type { Command, EditorState } from "@tiptap/pm/state";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import type { Sticker } from "@blog-editor/content-schema";
import {
  fontOrNull,
  motionOrNull,
  stickerFieldOrNull,
  stickerIdOrNull,
  widthOrNull,
} from "../closed-values";

/**
 * 꾸미기 커맨드 — spec: editor-decoration, design.md.
 * 꾸미기 자리는 최상위 블록에만 있다(adr-008). 값은 closed-values(content-schema 상수)로만 거르고,
 * 닫힌 집합 밖이면 자르지 않고 dispatch 없이 false다(https://prosemirror.net/docs/ref/#state.Command).
 * 속성은 setNodeAttribute(AttrStep)로 바꾼다 — 위치가 움직이지 않아 노드 선택이 그대로 남는다
 * (https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute).
 */

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
/** 블록 사각형(px) — 측정은 UI가 하고 이 모듈은 숫자만 본다 */
export interface BlockRect {
  pos: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

type Coordinates = Omit<StickerPlacement, "blockPos">;

/** 디자인 69:2의 코랄 별 자리 — 블록 오른쪽 위 모서리, 약 88px / 600px(design.md 2) */
const DEFAULT_COORDINATES: Coordinates = { x: 95, y: 5, size: 15, rotate: 0 };

const PERCENT = 100;

interface TopBlock {
  pos: number;
  node: Node;
}

const canHold = (node: Node, key: string) => Object.hasOwn(node.type.spec.attrs ?? {}, key);

/**
 * 선택이 걸친 최상위 블록들. 노드 선택의 끝(깊이 0)은 다음 블록 index라 그 블록은 뺀다(design.md 1).
 * AllSelection과 깊이 0 빈 선택(GapCursor)은 대상이 없다.
 */
function selectedTopBlocks(state: EditorState): TopBlock[] {
  const { selection, doc } = state;
  const { $from, $to, empty } = selection;
  if (selection instanceof AllSelection || (empty && $from.depth === 0)) return [];
  const start = $from.index(0);
  const end = $to.depth === 0 ? $to.index(0) : $to.index(0) + 1;
  const blocks: TopBlock[] = [];
  let pos = $from.posAtIndex(start, 0);
  for (let index = start; index < end; index += 1) {
    const node = doc.child(index);
    blocks.push({ pos, node });
    pos += node.nodeSize;
  }
  return blocks;
}

/** pos가 최상위 블록 경계에서 시작하는 블록이면 그 노드, 아니면 null */
function topBlockAt(doc: Node, pos: number): Node | null {
  if (!Number.isInteger(pos) || pos < 0 || pos >= doc.content.size) return null;
  // https://prosemirror.net/docs/ref/#model.ResolvedPos.depth — 최상위 블록 사이 경계는 깊이 0
  if (doc.resolve(pos).depth !== 0) return null;
  const node = doc.nodeAt(pos);
  return node !== null && canHold(node, "stickers") ? node : null;
}

function setOnSelectedBlocks(key: string, value: unknown): Command {
  return (state, dispatch) => {
    const blocks = selectedTopBlocks(state);
    if (blocks.length === 0 || !blocks.every(({ node }) => canHold(node, key))) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { pos } of blocks) tr.setNodeAttribute(pos, key, value);
      dispatch(tr);
    }
    return true;
  };
}

const rejected: Command = () => false;

/** null이면 지운다. 집합 밖 값이면 어떤 상태에서도 false */
function setClosedValue(key: string, value: string | null, parse: (value: unknown) => unknown) {
  if (value === null) return setOnSelectedBlocks(key, null);
  const valid = parse(value);
  return valid === null ? rejected : setOnSelectedBlocks(key, valid);
}

export const setBlockFont = (font: string | null): Command =>
  setClosedValue("font", font, fontOrNull);

export const setBlockMotion = (motion: string | null): Command =>
  setClosedValue("motion", motion, motionOrNull);

export function setBlockWidth(percent: number): Command {
  const width = widthOrNull(percent);
  return width === null ? rejected : setOnSelectedBlocks("width", width);
}

// ── 스티커 ──

/** 닫힌 집합 안이면 스티커, 아니면 null — 자르지 않는다(design.md 2) */
function stickerOf(id: unknown, { x, y, size, rotate }: Coordinates): Sticker | null {
  const sticker = {
    id: stickerIdOrNull(id),
    x: stickerFieldOrNull("x", x),
    y: stickerFieldOrNull("y", y),
    size: stickerFieldOrNull("size", size),
    rotate: stickerFieldOrNull("rotate", rotate),
  };
  return Object.values(sticker).every((value) => value !== null) ? (sticker as Sticker) : null;
}

const stickersOf = (node: Node): Sticker[] =>
  Array.isArray(node.attrs.stickers) ? (node.attrs.stickers as Sticker[]) : [];

/** 빈 배열은 정규형에서 지워지는 값이라 null로 둔다 */
const stickersAttr = (stickers: Sticker[]) => (stickers.length > 0 ? stickers : null);

function stickerCount(doc: Node): number {
  let count = 0;
  doc.forEach((block) => {
    count += stickersOf(block).length;
  });
  return count;
}

/** 커서가 있는 최상위 블록의 시작 위치. 대상이 없으면 null */
function cursorBlockPos(state: EditorState): number | null {
  const [first] = selectedTopBlocks(state);
  return first === undefined ? null : first.pos;
}

/** 블록 pos의 스티커 목록을 바꾸는 커맨드 — change가 null이면 false */
function changeStickers(
  blockPos: number,
  change: (stickers: Sticker[], state: EditorState) => Sticker[] | null,
): Command {
  return (state, dispatch) => {
    const block = topBlockAt(state.doc, blockPos);
    const next = block === null ? null : change(stickersOf(block), state);
    if (next === null) return false;
    if (dispatch) dispatch(state.tr.setNodeAttribute(blockPos, "stickers", stickersAttr(next)));
    return true;
  };
}

export function addSticker(id: string, placement?: StickerPlacement): Command {
  const sticker = stickerOf(id, placement ?? DEFAULT_COORDINATES);
  return (state, dispatch) => {
    const blockPos = placement?.blockPos ?? cursorBlockPos(state);
    if (sticker === null || blockPos === null || stickerCount(state.doc) >= MAX_STICKERS_PER_DOC) {
      return false;
    }
    return changeStickers(blockPos, (stickers) => [...stickers, sticker])(state, dispatch);
  };
}

export const updateSticker = (blockPos: number, index: number, patch: StickerPatch): Command =>
  changeStickers(blockPos, (stickers) => {
    const current = stickers[index];
    const next = current === undefined ? null : stickerOf(current.id, { ...current, ...patch });
    return next === null ? null : stickers.map((sticker, i) => (i === index ? next : sticker));
  });

export const removeSticker = (blockPos: number, index: number): Command =>
  changeStickers(blockPos, (stickers) =>
    index >= 0 && index < stickers.length ? stickers.filter((_, i) => i !== index) : null,
  );

/**
 * 스티커를 다른 블록 끝으로 옮긴다. 같은 블록이면 제자리에서 좌표만 바꾼다. 회전은 유지한다.
 * AttrStep은 위치를 움직이지 않아 두 블록 위치가 한 트랜잭션 안에서 그대로 유효하다(design.md 2).
 */
export function moveStickerToBlock(fromPos: number, index: number, target: StickerTarget): Command {
  return (state, dispatch) => {
    const { blockPos, ...coordinates } = target;
    if (blockPos === fromPos) {
      return updateSticker(fromPos, index, coordinates)(state, dispatch);
    }
    const source = topBlockAt(state.doc, fromPos);
    const destination = topBlockAt(state.doc, blockPos);
    const current = source === null ? undefined : stickersOf(source)[index];
    const moved =
      current === undefined
        ? null
        : stickerOf(current.id, { ...coordinates, rotate: current.rotate });
    if (source === null || destination === null || moved === null) return false;
    if (dispatch) {
      const remaining = stickersOf(source).filter((_, i) => i !== index);
      dispatch(
        state.tr
          .setNodeAttribute(fromPos, "stickers", stickersAttr(remaining))
          .setNodeAttribute(blockPos, "stickers", [...stickersOf(destination), moved]),
      );
    }
    return true;
  };
}

// ── 놓은 자리 → 가장 가까운 블록 ──

/** 점에서 사각형까지 거리 — 안이면 0 */
function distanceTo(block: BlockRect, point: { x: number; y: number }): number {
  const dx = Math.max(block.left - point.x, 0, point.x - (block.left + block.width));
  const dy = Math.max(block.top - point.y, 0, point.y - (block.top + block.height));
  return Math.hypot(dx, dy);
}

/**
 * 놓은 스티커 중심(px)에서 가장 가까운 블록과 그 블록 기준 % 좌표(design.md 3). 같은 거리면 앞 블록.
 * x · y는 중심의 블록 폭 · 높이 기준 %, size는 블록 폭 기준 % — content-render post.css `.post-sticker`와 같다.
 * 범위 밖이면 놓을 수 없는 자리라 null이다.
 */
export function placeOnNearestBlock(
  blocks: readonly BlockRect[],
  point: { x: number; y: number },
  stickerWidth: number,
): StickerTarget | null {
  let nearest: BlockRect | null = null;
  for (const block of blocks) {
    if (block.width <= 0 || block.height <= 0) continue;
    if (nearest === null || distanceTo(block, point) < distanceTo(nearest, point)) nearest = block;
  }
  if (nearest === null) return null;
  const percentOf = (value: number, whole: number) => Math.round((value / whole) * PERCENT) + 0; // + 0: -0을 0으로
  const x = stickerFieldOrNull("x", percentOf(point.x - nearest.left, nearest.width));
  const y = stickerFieldOrNull("y", percentOf(point.y - nearest.top, nearest.height));
  const size = stickerFieldOrNull("size", percentOf(stickerWidth, nearest.width));
  return x === null || y === null || size === null ? null : { blockPos: nearest.pos, x, y, size };
}
