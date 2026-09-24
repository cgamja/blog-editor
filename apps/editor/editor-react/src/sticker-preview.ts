import type { Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";
import { moveStickerToBlock, placeStickerNear, updateSticker } from "@blog-editor/editor-core";
import type { StickerRef } from "@blog-editor/editor-core";
import { measureBlocks, type StickerBox } from "./sticker-measure";
import { anchorLabel, resizedSize, rotatedAngle } from "./sticker-ui";

/**
 * 끄는 동안의 유령과 놓았을 때 실행할 커맨드 — sticker-drag design.md 1 · 3.
 * 끄는 동안 문서는 그대로다. 놓을 때 여기서 고른 커맨드 하나만 실행한다(트랜잭션 1번).
 */

export type GestureKind = "move" | "resize" | "rotate";

export interface Gesture {
  kind: GestureKind;
  box: StickerBox;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

export interface Preview {
  /** 유령 중심(client px) */
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

export const CANNOT_PLACE = "여기에는 놓을 수 없어요. 문단이나 사진 가까이에 놓아 주세요.";

const PERCENT = 100;

export const refOf = ({ blockPos, index }: StickerBox): StickerRef => ({ blockPos, index });

export function stickersIn(editor: Editor, blockPos: number): number {
  return ((editor.state.doc.nodeAt(blockPos)?.attrs.stickers ?? []) as unknown[]).length;
}

export function stickerCount(editor: Editor): number {
  let count = 0;
  editor.state.doc.forEach((node) => {
    count += ((node.attrs.stickers ?? []) as unknown[]).length;
  });
  return count;
}

/** 옮기기 — 놓을 자리는 placeStickerNear가 정하고, 유령은 스냅된 자리에 그린다 */
function movePreview(editor: Editor, gesture: Gesture): Preview {
  const { box } = gesture;
  const point = {
    x: box.centerX + gesture.x - gesture.startX,
    y: box.centerY + gesture.y - gesture.startY,
  };
  const blocks = measureBlocks(editor.view);
  const target = placeStickerNear(blocks, point, box.width);
  const block = target === null ? undefined : blocks.find(({ pos }) => pos === target.blockPos);
  if (target === null || block === undefined) {
    return {
      centerX: point.x,
      centerY: point.y,
      width: box.width,
      rotate: box.rotate,
      label: CANNOT_PLACE,
      command: null,
      next: null,
    };
  }
  const sameBlock = target.blockPos === box.blockPos;
  return {
    centerX: block.left + (target.x / PERCENT) * block.width,
    centerY: block.top + (target.y / PERCENT) * block.height,
    width: (target.size / PERCENT) * block.width,
    rotate: box.rotate,
    label: anchorLabel(editor.state.doc.nodeAt(target.blockPos)?.type.name ?? ""),
    command: moveStickerToBlock(box.blockPos, box.index, target),
    // 다른 블록이면 그 블록 끝에 붙는다(moveStickerToBlock)
    next: sameBlock
      ? refOf(box)
      : { blockPos: target.blockPos, index: stickersIn(editor, target.blockPos) },
  };
}

const distanceFrom = (box: StickerBox, x: number, y: number) =>
  Math.hypot(x - box.centerX, y - box.centerY);
const angleFrom = (box: StickerBox, x: number, y: number) =>
  Math.atan2(y - box.centerY, x - box.centerX);

export function previewOf(editor: Editor, gesture: Gesture): Preview {
  const { box, startX, startY, x, y } = gesture;
  if (gesture.kind === "move") return movePreview(editor, gesture);
  const unmoved = {
    centerX: box.centerX,
    centerY: box.centerY,
    label: anchorLabel(box.nodeName),
    next: refOf(box),
  };
  if (gesture.kind === "resize") {
    const size = resizedSize(box.size, distanceFrom(box, startX, startY), distanceFrom(box, x, y));
    return {
      ...unmoved,
      width: (size / PERCENT) * box.blockWidth,
      rotate: box.rotate,
      command: updateSticker(box.blockPos, box.index, { size }),
    };
  }
  const rotate = rotatedAngle(box.rotate, angleFrom(box, startX, startY), angleFrom(box, x, y));
  return {
    ...unmoved,
    width: box.width,
    rotate,
    command: updateSticker(box.blockPos, box.index, { rotate }),
  };
}
