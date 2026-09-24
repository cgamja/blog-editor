import type { EditorView } from "@tiptap/pm/view";
import type { BlockRect } from "@blog-editor/editor-core";

/**
 * 스티커 오버레이가 재는 DOM 사각형 — 뷰포트(client) 좌표. 계산은 editor-core 순수 함수가 한다.
 * 스티커의 % 기준은 최상위 블록의 바깥 DOM(`div.post-block` 래퍼, 없으면 블록 요소)이다(post.css).
 * https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM
 */

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
  /** 중심(client px) */
  centerX: number;
  centerY: number;
  /** 스티커가 붙은 블록 폭(px) — 크기 %를 px로 바꿀 때 */
  blockWidth: number;
}

interface StickerAttrs {
  id: string;
  size: number;
  rotate: number;
}

const topBlockElement = (view: EditorView, pos: number): HTMLElement | null => {
  const dom = view.nodeDOM(pos);
  return dom instanceof HTMLElement ? dom : null;
};

export function measureBlocks(view: EditorView): BlockRect[] {
  const blocks: BlockRect[] = [];
  view.state.doc.forEach((_node, pos) => {
    const rect = topBlockElement(view, pos)?.getBoundingClientRect();
    if (rect !== undefined) {
      blocks.push({ pos, left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }
  });
  return blocks;
}

export function measureStickers(view: EditorView): StickerBox[] {
  const boxes: StickerBox[] = [];
  view.state.doc.forEach((node, blockPos) => {
    const stickers = (node.attrs.stickers ?? []) as readonly StickerAttrs[];
    const block = stickers.length > 0 ? topBlockElement(view, blockPos) : null;
    if (block === null) return;
    const images = block.querySelectorAll<HTMLImageElement>(":scope > img.post-sticker");
    const blockWidth = block.getBoundingClientRect().width;
    stickers.forEach((sticker, index) => {
      const image = images[index];
      if (image === undefined) return;
      const rect = image.getBoundingClientRect();
      boxes.push({
        key: `${blockPos}:${index}`,
        blockPos,
        index,
        id: sticker.id,
        src: image.currentSrc || image.src,
        size: sticker.size,
        rotate: sticker.rotate,
        nodeName: node.type.name,
        width: image.offsetWidth,
        height: image.offsetHeight,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        blockWidth,
      });
    });
  });
  return boxes;
}
