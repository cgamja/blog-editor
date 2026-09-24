import { useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import { addSticker, placeStickerNear } from "@blog-editor/editor-core";
import type { StickerRef } from "@blog-editor/editor-core";
import { measureBlocks } from "./sticker-measure";
import { CANNOT_PLACE, stickerCount, stickersIn } from "./sticker-preview";
import { readStickerDrag } from "./sticker-ui";

export const STICKER_LIMIT_MESSAGE = `스티커는 글 하나에 ${MAX_STICKERS_PER_DOC}개까지예요.`;

/** 패널에서 끌어 온 스티커의 처음 폭 — 디자인 69:2 코랄 별(88px / 600px ≈ 15%, design.md 5) */
const PANEL_DROP_WIDTH_PX = 88;

interface StickerDropHandlers {
  onPlaced: (ref: StickerRef) => void;
  onRejected: (message: string) => void;
}

/**
 * 패널 격자에서 끌어 온 스티커를 놓은 자리에 붙인다. 우리 형식이면 true를 돌려 ProseMirror 기본 삽입을 막고,
 * 아니면 false로 기본 처리(글 끌어 옮기기 등)에 넘긴다. 조합 중에는 문서를 바꾸지 않는다.
 * https://prosemirror.net/docs/ref/#view.EditorProps.handleDrop · https://tiptap.dev/docs/editor/api/editor#register-plugin
 */
export function useStickerDrop(editor: Editor, { onPlaced, onRejected }: StickerDropHandlers) {
  useEffect(() => {
    const key = new PluginKey("stickerDrop");
    const plugin = new Plugin({
      key,
      props: {
        handleDrop(view, event) {
          const id = event.dataTransfer === null ? null : readStickerDrag(event.dataTransfer);
          if (id === null) return false;
          if (view.composing) return true;
          if (stickerCount(editor) >= MAX_STICKERS_PER_DOC) {
            onRejected(STICKER_LIMIT_MESSAGE);
            return true;
          }
          const point = { x: event.clientX, y: event.clientY };
          const target = placeStickerNear(measureBlocks(view), point, PANEL_DROP_WIDTH_PX);
          if (target === null) {
            onRejected(CANNOT_PLACE);
            return true;
          }
          const index = stickersIn(editor, target.blockPos);
          if (addSticker(id, { ...target, rotate: 0 })(view.state, view.dispatch)) {
            onPlaced({ blockPos: target.blockPos, index });
          }
          return true;
        },
      },
    });
    editor.registerPlugin(plugin);
    return () => void editor.unregisterPlugin(key);
  }, [editor, onPlaced, onRejected]);
}
