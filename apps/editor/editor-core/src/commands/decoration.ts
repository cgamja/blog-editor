import type { Node } from "@tiptap/pm/model";
import { AllSelection } from "@tiptap/pm/state";
import type { Command, EditorState } from "@tiptap/pm/state";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import type { Sticker } from "@blog-editor/content-schema";
import { fontOrNull, motionOrNull, stickerOrNull, widthOrNull } from "../closed-values";
import { DEFAULT_COORDINATES } from "./decoration.constants";
import { sameStickers, stickerCount, stickersOf } from "./sticker-query";
import type { StickerPatch, StickerPlacement, StickerTarget, TopBlock } from "./decoration.types";

/**
 * 꾸미기 커맨드 — spec: editor-decoration, design.md.
 * 꾸미기 자리는 최상위 블록에만 있다(adr-008). 값은 closed-values(content-schema 상수)로만 거르고,
 * 닫힌 집합 밖이면 자르지 않고 dispatch 없이 false다(https://prosemirror.net/docs/ref/#state.Command).
 * 속성은 setNodeAttribute(AttrStep)로 바꾼다 — 위치가 움직이지 않아 노드 선택이 그대로 남는다
 * (https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute).
 */

type Coordinates = Omit<StickerPlacement, "blockPos">;

/** 이 블록 노드가 꾸미기 속성 key(font · motion · width · align · stickers)를 가질 수 있나 — 패널의 막힌 이유 판정도 이것을 쓴다 */
export const canHoldDecoration = (node: Node, key: string) =>
  Object.hasOwn(node.type.spec.attrs ?? {}, key);

/**
 * 선택이 걸친 최상위 블록들. 노드 선택의 끝(깊이 0)은 다음 블록 index라 그 블록은 뺀다(design.md 1).
 * AllSelection과 깊이 0 빈 선택(GapCursor)은 대상이 없다.
 */
export function selectedTopBlocks(state: EditorState): TopBlock[] {
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
  return node !== null && canHoldDecoration(node, "stickers") ? node : null;
}

function setOnSelectedBlocks(key: string, value: unknown): Command {
  return (state, dispatch) => {
    const blocks = selectedTopBlocks(state);
    if (blocks.length === 0 || !blocks.every(({ node }) => canHoldDecoration(node, key)))
      return false;
    // 이미 같은 값이면 true(가질 수 있다)이되 dispatch하지 않는다 — 빈 undo 단계를 쌓지 않는다(design.md 1)
    const changed = blocks.filter(({ node }) => node.attrs[key] !== value);
    if (dispatch && changed.length > 0) {
      const tr = state.tr;
      for (const { pos } of changed) tr.setNodeAttribute(pos, key, value);
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
const stickerOf = (id: unknown, coordinates: Coordinates): Sticker | null =>
  stickerOrNull({ id, ...coordinates });

/** 빈 배열은 정규형에서 지워지는 값이라 null로 둔다 */
const stickersAttr = (stickers: Sticker[]) => (stickers.length > 0 ? stickers : null);

function cursorBlockPos(state: EditorState): number | null {
  const [first] = selectedTopBlocks(state);
  return first === undefined ? null : first.pos;
}

/**
 * 블록 pos의 스티커 목록을 바꾸는 커맨드 — change가 null이면 false.
 * 결과가 지금과 같으면 true이되 dispatch하지 않는다 — 빈 undo 단계를 쌓지 않는다(글꼴 · 움직임과 같은 규칙)
 */
function changeStickers(
  blockPos: number,
  change: (stickers: Sticker[], state: EditorState) => Sticker[] | null,
): Command {
  return (state, dispatch) => {
    const block = topBlockAt(state.doc, blockPos);
    const current = block === null ? [] : stickersOf(block);
    const next = block === null ? null : change(current, state);
    if (next === null) return false;
    if (dispatch && !sameStickers(current, next)) {
      dispatch(state.tr.setNodeAttribute(blockPos, "stickers", stickersAttr(next)));
    }
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
    // 비정수 · 범위 밖 순번은 undefined — true + 빈 dispatch가 되지 않게 updateSticker와 같이 거른다
    stickers[index] === undefined ? null : stickers.filter((_, i) => i !== index),
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
