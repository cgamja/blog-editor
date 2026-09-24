import type { EditorView } from "@tiptap/pm/view";
import { stickersIn } from "@blog-editor/editor-core";
import type { BlockRect } from "@blog-editor/editor-core";
import { keyOf } from "./sticker-ref";
import type { StickerBox } from "./sticker-types";

/**
 * 스티커 오버레이가 재는 DOM 사각형 — 잰 즉시 레이어 기준 px로 바꾼다(origin = 레이어의 client 사각형).
 * 스티커의 % 기준은 최상위 블록의 바깥 DOM(`div.post-block` 래퍼, 없으면 블록 요소)이다(post.css).
 * https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM
 */

interface Origin {
  left: number;
  top: number;
}

const topBlockElement = (view: EditorView, pos: number): HTMLElement | null => {
  const dom = view.nodeDOM(pos);
  return dom instanceof HTMLElement ? dom : null;
};

export function measureBlocks(view: EditorView, origin: Origin): BlockRect[] {
  const blocks: BlockRect[] = [];
  view.state.doc.forEach((_node, pos) => {
    const rect = topBlockElement(view, pos)?.getBoundingClientRect();
    if (rect === undefined) return;
    blocks.push({
      pos,
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    });
  });
  return blocks;
}

export function measureStickers(view: EditorView, origin: Origin): StickerBox[] {
  const boxes: StickerBox[] = [];
  view.state.doc.forEach((node, blockPos) => {
    const stickers = stickersIn(view.state.doc, blockPos);
    const block = stickers.length > 0 ? topBlockElement(view, blockPos) : null;
    if (block === null) return;
    const images = block.querySelectorAll<HTMLImageElement>(":scope > img.post-sticker");
    const blockWidth = block.getBoundingClientRect().width;
    stickers.forEach((sticker, index) => {
      const image = images[index];
      if (image === undefined) return;
      const rect = image.getBoundingClientRect();
      boxes.push({
        key: keyOf({ blockPos, index }),
        blockPos,
        index,
        id: sticker.id,
        src: image.currentSrc || image.src,
        size: sticker.size,
        rotate: sticker.rotate,
        nodeName: node.type.name,
        width: image.offsetWidth,
        height: image.offsetHeight,
        centerX: rect.left + rect.width / 2 - origin.left,
        centerY: rect.top + rect.height / 2 - origin.top,
        blockWidth,
      });
    });
  });
  return boxes;
}
