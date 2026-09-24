import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { SlashItem } from "./slash-items";

/** 고른 항목 번호 — query가 바뀌면 첫 항목부터 */
interface ActiveItem {
  query: string;
  index: number;
}

export interface SlashMenuKeys {
  /** 지금 고른 항목. 목록이 비었으면 undefined */
  current: SlashItem | undefined;
}

/**
 * 슬래시 메뉴의 방향키 · Enter · Tab. editor-core 플러그인이 조합 중이 아닐 때만 `editor.storage.slashMenu.onKey`로
 * 넘기는 키를 받아 고른 항목을 옮기거나(끝에서 돌아간다) `onChoose`를 부른다.
 * 처리기는 최신 목록 · 번호를 봐야 해서 렌더가 끝난 뒤 ref로 갈아 끼운다.
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#storage
 */
export function useSlashMenuKeys(
  editor: Editor,
  query: string | null,
  items: readonly SlashItem[],
  onChoose: (kind: SlashItem) => void,
): SlashMenuKeys {
  const [active, setActive] = useState<ActiveItem>({ query: "", index: 0 });
  const index = active.query === query ? Math.min(active.index, items.length - 1) : 0;
  const current = items[index];

  const onKeyRef = useRef<(key: string) => boolean>(() => false);
  useEffect(() => {
    onKeyRef.current = (key) => {
      if (query === null || current === undefined) return false;
      if (key === "Enter" || key === "Tab") {
        onChoose(current);
        return true;
      }
      const step = key === "ArrowDown" ? 1 : -1;
      setActive({ query, index: (index + step + items.length) % items.length });
      return true;
    };
  }, [query, current, index, items, onChoose]);

  useEffect(() => {
    const storage = editor.storage.slashMenu;
    storage.onKey = (key) => onKeyRef.current(key);
    return () => {
      storage.onKey = null;
    };
  }, [editor]);

  return { current };
}
