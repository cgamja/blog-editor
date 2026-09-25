import { useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { keydownHandler } from "@tiptap/pm/keymap";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import type { Sticker } from "@blog-editor/content-schema";
import { pasteStickerBeside, stickerCount, stickersIn } from "@blog-editor/editor-core";
import type { StickerRef } from "@blog-editor/editor-core";
import { STICKER_MESSAGES } from "./sticker-messages";
import type { StickerSelection } from "./use-sticker-selection";

/** 스티커 버튼의 keydown을 받아 처리했으면 true — 부르는 쪽이 preventDefault한다 */
export type StickerClipboardKeyHandler = (ref: StickerRef, event: KeyboardEvent) => boolean;

/**
 * 고른 스티커의 복사 · 붙여넣기(spec: editor-sticker-copy). 복사해 둔 스티커는 탭 메모리(이 훅의 ref)에만 둔다 —
 * 시스템 클립보드에 실으면 닫힌 집합 밖 입력 길이 된다(adr-027).
 * 스티커 버튼에 포커스가 있을 때 Mod-c · Mod-v는 할 일이 없어도 받아 기본 동작을 막는다. 스티커 버튼을 누를 때
 * pointerdown을 막아 본문의 DOM 선택이 남아 있어, 넘기면 브라우저가 그 선택을 복사하거나 그 자리에 붙여 넣는다.
 * keydownHandler는 Mod를 플랫폼대로 풀고, 한글 자판의 ⌘ㅊ처럼 key가 ASCII가 아니면 keyCode로 되찾는다
 * (prosemirror-keymap 1.2.3 keydownHandler · https://prosemirror.net/docs/ref/#keymap.keydownHandler).
 */
export function useStickerClipboard(
  editor: Editor,
  selection: StickerSelection,
  setStatus: (message: string) => void,
): StickerClipboardKeyHandler {
  const copied = useRef<Sticker | null>(null);

  const handleStickerCopyKey = useCallback(
    (ref: StickerRef): boolean => {
      copied.current = stickersIn(editor.state.doc, ref.blockPos)[ref.index] ?? null;
      return true;
    },
    [editor],
  );

  const handleStickerPasteKey = useCallback(
    (ref: StickerRef): boolean => {
      const sticker = copied.current;
      if (sticker === null) return true;
      if (stickerCount(editor.state.doc) >= MAX_STICKERS_PER_DOC) {
        setStatus(STICKER_MESSAGES.limit);
        return true;
      }
      const pasted = pasteStickerBeside(sticker, ref)(editor.state, (tr) =>
        editor.view.dispatch(tr),
      );
      if (pasted) {
        setStatus("");
        // 새 스티커는 그 블록 스티커의 마지막 순번이다(pasteStickerBeside)
        const index = stickersIn(editor.state.doc, ref.blockPos).length - 1;
        selection.selectAndFocus({ blockPos: ref.blockPos, index });
      }
      return true;
    },
    [editor, selection.selectAndFocus, setStatus],
  );

  return useCallback(
    (ref: StickerRef, event: KeyboardEvent) =>
      keydownHandler({
        "Mod-c": () => handleStickerCopyKey(ref),
        "Mod-v": () => handleStickerPasteKey(ref),
      })(editor.view, event),
    [editor, handleStickerCopyKey, handleStickerPasteKey],
  );
}
