import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import {
  addSticker,
  DEFAULT_COORDINATES,
  placeStickerNear,
  stickerCount,
  stickersIn,
} from "@blog-editor/editor-core";
import type { StickerRef } from "@blog-editor/editor-core";
import { STICKER_MESSAGES } from "./sticker-messages";
import { readStickerDrag } from "./sticker-ui";
import type { StickerLayout } from "./use-sticker-layout";

/** 디자인 종이의 글 폭 — tokens.json article-width 760px − article-padding-x 80px × 2 */
const DESIGN_TEXT_WIDTH_PX = 600;
const PERCENT = 100;

/**
 * 패널에서 끌어 온 스티커의 처음 폭 — 커맨드 기본 크기(블록 폭의 %)를 디자인 글 폭에 적용한 값(600 × 8% = 48px).
 * 놓은 블록의 폭으로 %를 다시 재므로 px로 한 번 정해 둔다(이슈 #71).
 */
const PANEL_DROP_WIDTH_PX = (DESIGN_TEXT_WIDTH_PX * DEFAULT_COORDINATES.size) / PERCENT;

interface StickerDropHandlers {
  onPlaced: (ref: StickerRef) => void;
  onRejected: (message: string) => void;
}

/**
 * 패널 격자에서 끌어 온 스티커를 놓은 자리에 붙인다. 우리 형식이면 true를 돌려 ProseMirror 기본 삽입을 막고,
 * 아니면 false로 기본 처리(글 끌어 옮기기 등)에 넘긴다. 조합 중에는 문서를 바꾸지 않는다.
 * https://prosemirror.net/docs/ref/#view.EditorProps.handleDrop · https://tiptap.dev/docs/editor/api/editor#register-plugin
 */
export function useStickerDrop(
  editor: Editor,
  { measureBlocksNow, toLayerPoint }: StickerLayout,
  { onPlaced, onRejected }: StickerDropHandlers,
) {
  useEffect(() => {
    const key = new PluginKey("stickerDrop");
    const plugin = new Plugin({
      key,
      props: {
        handleDrop(view, event) {
          const id = event.dataTransfer === null ? null : readStickerDrag(event.dataTransfer);
          if (id === null) return false;
          if (view.composing) return true;
          const { doc } = view.state;
          if (stickerCount(doc) >= MAX_STICKERS_PER_DOC) {
            onRejected(STICKER_MESSAGES.limit);
            return true;
          }
          const point = toLayerPoint(event.clientX, event.clientY);
          const target = placeStickerNear(measureBlocksNow(), point, PANEL_DROP_WIDTH_PX);
          if (target === null) {
            onRejected(STICKER_MESSAGES.cannotPlace);
            return true;
          }
          const index = stickersIn(doc, target.blockPos).length;
          if (addSticker(id, { ...target, rotate: 0 })(view.state, view.dispatch)) {
            onPlaced({ blockPos: target.blockPos, index });
          }
          return true;
        },
      },
    });
    editor.registerPlugin(plugin);
    return () => void editor.unregisterPlugin(key);
  }, [editor, measureBlocksNow, toLayerPoint, onPlaced, onRejected]);
}
