import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { applySlashItem, slashMenuKey } from "@blog-editor/editor-core";
import type { InsertableBlockKind, SlashMenuState } from "@blog-editor/editor-core";
import { INSERTABLE_BLOCK_LABELS, SLASH_MENU_MESSAGES } from "./messages";
import { SELECTION_POPUP_GAP_PX } from "./popup-constants";
import { filterSlashItems } from "./slash-items";
import { useCommandRunner } from "./use-command-runner";
import { useSlashMenuAutoClose } from "./use-slash-menu-auto-close";
import { useSlashMenuKeys } from "./use-slash-menu-keys";

export interface SlashMenuProps {
  editor: Editor;
  /** 목록 좌표의 기준(BlogEditor 바깥 틀, position: relative) */
  frameRef: RefObject<HTMLDivElement | null>;
}

interface Position {
  top: number;
  left: number;
}

const sameMenu = (a: SlashMenuState | null, b: SlashMenuState | null) =>
  a?.from === b?.from && a?.query === b?.query;

/**
 * `/` 슬래시 메뉴(spec: editor-slash-menu). 에디터 포커스를 둔 채 쓰는 listbox다 — contenteditable에
 * `aria-controls` · `aria-activedescendant`를 달아 고른 항목을 알린다(APG combobox,
 * https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). 방향키 · Enter · Tab은 editor-core 플러그인이
 * 조합 중이 아닐 때만 `editor.storage.slashMenu.onKey`로 넘긴다. 일치 항목이 없으면 닫는다.
 */
export function SlashMenu({ editor, frameRef }: SlashMenuProps) {
  const run = useCommandRunner(editor);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const menu = useEditorState({
    editor,
    selector: ({ editor: current }) => slashMenuKey.getState(current.state) ?? null,
    equalityFn: sameMenu,
  });
  const query = menu?.query ?? null;
  const items = useMemo(() => (query === null ? [] : filterSlashItems(query)), [query]);
  const optionId = (kind: InsertableBlockKind) => `${listId}-${kind}`;
  const position = useSlashMenuPosition(editor, frameRef, menu?.from ?? null, query);

  const choose = useCallback(
    (kind: InsertableBlockKind) => {
      run(applySlashItem(kind));
    },
    [run],
  );
  const { current } = useSlashMenuKeys(editor, query, items, choose);
  useSlashMenuAutoClose(editor, query, items.length);

  useComboboxAttributes(
    editor,
    current === undefined ? null : listId,
    current && optionId(current),
  );

  useLayoutEffect(() => {
    if (current !== undefined) {
      listRef.current
        ?.querySelector(`[id="${optionId(current)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  });

  if (query === null || position === null || items.length === 0) return null;

  return (
    <div
      ref={listRef}
      id={listId}
      className="slash-menu"
      role="listbox"
      aria-label={SLASH_MENU_MESSAGES.menu}
      style={{ top: position.top, left: position.left }}
    >
      {items.map((kind) => (
        <div
          key={kind}
          id={optionId(kind)}
          role="option"
          tabIndex={-1}
          aria-selected={kind === current}
          // 누르는 순간 고른다 — mousedown을 막아 편집 영역 포커스와 선택이 그대로 남는다
          onMouseDown={(event) => {
            event.preventDefault();
            choose(kind);
          }}
        >
          {INSERTABLE_BLOCK_LABELS[kind]}
        </div>
      ))}
    </div>
  );
}

/**
 * `/` 글자 아래 자리(링크 팝오버 · 서식 도구줄과 같은 간격). 레이아웃을 읽으므로 그리기 직전(layout effect)에 잰다.
 * https://prosemirror.net/docs/ref/#view.EditorView.coordsAtPos
 */
function useSlashMenuPosition(
  editor: Editor,
  frameRef: RefObject<HTMLDivElement | null>,
  from: number | null,
  query: string | null,
): Position | null {
  const [position, setPosition] = useState<Position | null>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (from === null || frame === null) {
      setPosition(null);
      return;
    }
    const coords = editor.view.coordsAtPos(from);
    const origin = frame.getBoundingClientRect();
    setPosition({
      top: coords.bottom - origin.top + SELECTION_POPUP_GAP_PX,
      left: coords.left - origin.left,
    });
  }, [editor, frameRef, from, query]);
  return position;
}

/**
 * 편집 영역(contenteditable)에 메뉴를 알린다. ProseMirror는 자기가 단 속성만 다시 쓰므로 직접 달아도 남는다.
 * https://www.w3.org/TR/wai-aria-1.2/#aria-activedescendant
 */
function useComboboxAttributes(
  editor: Editor,
  listId: string | null,
  activeId: string | undefined,
): void {
  useEffect(() => {
    const dom = editor.view.dom;
    if (listId === null || activeId === undefined) return undefined;
    dom.setAttribute("aria-controls", listId);
    dom.setAttribute("aria-activedescendant", activeId);
    return () => {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
    };
  }, [editor, listId, activeId]);
}
