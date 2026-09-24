import type { Editor } from "@tiptap/react";
import {
  moveStickerToBlock,
  placeStickerNear,
  stickersIn,
  updateSticker,
} from "@blog-editor/editor-core";
import type { BlockRect } from "@blog-editor/editor-core";
import { anchorLabel, STICKER_MESSAGES } from "./sticker-messages";
import { refOf } from "./sticker-ref";
import type { Gesture, LayerPoint, Preview, StickerBox } from "./sticker-types";
import { resizedSize, rotatedAngle } from "./sticker-ui";

/**
 * 끄는 동안의 유령과 놓았을 때 실행할 커맨드 — sticker-drag design.md 1 · 3.
 * 끄는 동안 문서는 그대로다. 놓을 때 여기서 고른 커맨드 하나만 실행한다(트랜잭션 1번).
 * 좌표는 모두 레이어 기준 px.
 */

const PERCENT = 100;

/** 옮기기 — 놓을 자리는 placeStickerNear가 정하고, 유령은 스냅된 자리에 그린다 */
function movePreview(editor: Editor, gesture: Gesture, blocks: BlockRect[]): Preview {
  const { box, start, current } = gesture;
  const point = { x: box.centerX + current.x - start.x, y: box.centerY + current.y - start.y };
  const target = placeStickerNear(blocks, point, box.width);
  const block = target === null ? undefined : blocks.find(({ pos }) => pos === target.blockPos);
  if (target === null || block === undefined) {
    return {
      centerX: point.x,
      centerY: point.y,
      width: box.width,
      rotate: box.rotate,
      label: STICKER_MESSAGES.cannotPlace,
      command: null,
      next: null,
    };
  }
  const { doc } = editor.state;
  return {
    centerX: block.left + (target.x / PERCENT) * block.width,
    centerY: block.top + (target.y / PERCENT) * block.height,
    width: (target.size / PERCENT) * block.width,
    rotate: box.rotate,
    label: anchorLabel(doc.nodeAt(target.blockPos)?.type.name ?? ""),
    command: moveStickerToBlock(box.blockPos, box.index, target),
    // 다른 블록이면 그 블록 끝에 붙는다(moveStickerToBlock)
    next:
      target.blockPos === box.blockPos
        ? refOf(box)
        : { blockPos: target.blockPos, index: stickersIn(doc, target.blockPos).length },
  };
}

const distanceFrom = (box: StickerBox, { x, y }: LayerPoint) =>
  Math.hypot(x - box.centerX, y - box.centerY);
const angleFrom = (box: StickerBox, { x, y }: LayerPoint) =>
  Math.atan2(y - box.centerY, x - box.centerX);

const unmoved = (box: StickerBox) => ({
  centerX: box.centerX,
  centerY: box.centerY,
  label: anchorLabel(box.nodeName),
  next: refOf(box),
});

/** 크기 — 중심에서 조절점까지 거리 비율만큼 */
function resizePreview({ box, start, current }: Gesture): Preview {
  const size = resizedSize(box.size, distanceFrom(box, start), distanceFrom(box, current));
  return {
    ...unmoved(box),
    width: (size / PERCENT) * box.blockWidth,
    rotate: box.rotate,
    command: updateSticker(box.blockPos, box.index, { size }),
  };
}

/** 회전 — 중심 기준 각도가 바뀐 만큼 */
function rotatePreview({ box, start, current }: Gesture): Preview {
  const rotate = rotatedAngle(box.rotate, angleFrom(box, start), angleFrom(box, current));
  return {
    ...unmoved(box),
    width: box.width,
    rotate,
    command: updateSticker(box.blockPos, box.index, { rotate }),
  };
}

export function previewOf(editor: Editor, gesture: Gesture, blocks: BlockRect[]): Preview {
  if (gesture.kind === "move") return movePreview(editor, gesture, blocks);
  return gesture.kind === "resize" ? resizePreview(gesture) : rotatePreview(gesture);
}
