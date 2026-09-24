import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { mapStickerRef } from "@blog-editor/editor-core";
import type { StickerRef } from "@blog-editor/editor-core";
import { keyOf } from "./sticker-ref";
import type { StickerBox } from "./sticker-types";

export interface StickerSelection {
  selected: StickerRef | null;
  select: (ref: StickerRef | null) => void;
  /** 고르고, 버튼이 새로 그려지면 그 버튼으로 포커스를 옮긴다(다른 블록으로 옮긴 뒤 등) */
  selectAndFocus: (ref: StickerRef) => void;
  /** 고르기를 풀고 글쓰기로 돌아간다 */
  leave: () => void;
  registerButton: (key: string, element: HTMLButtonElement | null) => void;
}

/**
 * 고른 스티커 — (블록 위치, 순번) 참조를 트랜잭션마다 옮긴다(sticker-drag design.md 2).
 * 에디터에 포커스가 가면(글을 쓰러 돌아가면) 고르기를 푼다.
 */
export function useStickerSelection(editor: Editor, boxes: StickerBox[]): StickerSelection {
  const [selected, setSelected] = useState<StickerRef | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      setSelected((ref) => ref && mapStickerRef(ref, transaction.mapping, transaction.doc));
    };
    const handleEditorFocus = () => {
      pendingFocus.current = null;
      setSelected(null);
    };
    editor.on("transaction", handleTransaction);
    editor.on("focus", handleEditorFocus);
    return () => {
      editor.off("transaction", handleTransaction);
      editor.off("focus", handleEditorFocus);
    };
  }, [editor]);

  useLayoutEffect(() => {
    const key = pendingFocus.current;
    const button = key === null ? undefined : buttons.current.get(key);
    if (button === undefined) return;
    pendingFocus.current = null;
    button.focus();
  }, [boxes]);

  // 커맨드가 true여도 목록이 그대로면 dispatch가 없어 버튼이 다시 그려지지 않는다 —
  // 이미 있는 버튼이면 바로 포커스하고, 기다리는 포커스를 남기지 않는다(남으면 나중에 글 쓸 때 튄다)
  const selectAndFocus = useCallback((ref: StickerRef) => {
    const key = keyOf(ref);
    const button = buttons.current.get(key);
    if (button === undefined) pendingFocus.current = key;
    else {
      pendingFocus.current = null;
      button.focus();
    }
    setSelected(ref);
  }, []);

  const leave = useCallback(() => {
    pendingFocus.current = null;
    setSelected(null);
    editor.commands.focus();
  }, [editor]);

  const registerButton = useCallback((key: string, element: HTMLButtonElement | null) => {
    if (element === null) buttons.current.delete(key);
    else buttons.current.set(key, element);
  }, []);

  return { selected, select: setSelected, selectAndFocus, leave, registerButton };
}
