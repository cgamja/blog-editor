import type { Editor } from "@tiptap/react";
import {
  moveStickerToBlock,
  placeStickerNear,
  stickersIn,
  updateSticker,
} from "@blog-editor/editor-core";
import type { BlockRect } from "@blog-editor/editor-core";
import { refOf } from "./sticker-ref";
import type { Gesture, LayerPoint, LayerSize, Preview, StickerBox } from "./sticker-types";
import { cornerDistance, isInsideLayer, resizedSize, rotatedAngle } from "./sticker-ui";

/**
 * 끄는 동안의 유령과 놓았을 때 실행할 커맨드 — sticker-drag design.md 1 · 3.
 * 끄는 동안 문서는 그대로다. 놓을 때 여기서 고른 커맨드 하나만 실행한다(트랜잭션 1번).
 * 좌표는 모두 레이어 기준 px.
 */

const PERCENT = 100;

/**
 * 옮기기 — 놓을 자리는 placeStickerNear가 정하고, 유령은 스냅된 자리에 그린다.
 * 스냅에 거리 한도가 없으므로 포인터가 에디터 틀 밖이면 놓지 않고 취소한다(sticker-polish-review).
 */
function movePreview(
  editor: Editor,
  gesture: Gesture,
  blocks: BlockRect[],
  layerSize: LayerSize,
): Preview {
  const { box, start, current } = gesture;
  const point = { x: box.centerX + current.x - start.x, y: box.centerY + current.y - start.y };
  const inside = isInsideLayer(current, layerSize);
  const target = inside ? placeStickerNear(blocks, point, box.width) : null;
  const block = target === null ? undefined : blocks.find(({ pos }) => pos === target.blockPos);
  if (target === null || block === undefined) {
    return {
      centerX: point.x,
      centerY: point.y,
      width: box.width,
      rotate: box.rotate,
      command: null,
      cancelled: !inside,
      next: null,
    };
  }
  const { doc } = editor.state;
  return {
    centerX: block.left + (target.x / PERCENT) * block.width,
    centerY: block.top + (target.y / PERCENT) * block.height,
    width: (target.size / PERCENT) * block.width,
    rotate: box.rotate,
    command: moveStickerToBlock(box.blockPos, box.index, target),
    cancelled: false,
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
  cancelled: false,
  next: refOf(box),
});

/**
 * 크기 — 기준은 모서리까지 거리이고, 손이 중심에서 멀어진 만큼 더한다. 누른 점까지 거리를 기준으로 쓰면
 * 중심 가까이를 눌렀을 때 폭주하고, 모서리까지 거리만 쓰면 조절점 칸 안쪽을 눌렀을 때 첫 움직임에 튄다.
 */
function resizePreview({ box, start, current }: Gesture): Preview {
  const base = cornerDistance(box.width, box.height);
  const size = resizedSize(
    box.size,
    base,
    base + distanceFrom(box, current) - distanceFrom(box, start),
  );
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

export function previewOf(
  editor: Editor,
  gesture: Gesture,
  blocks: BlockRect[],
  layerSize: LayerSize,
): Preview {
  if (gesture.kind === "move") return movePreview(editor, gesture, blocks, layerSize);
  return gesture.kind === "resize" ? resizePreview(gesture) : rotatePreview(gesture);
}
