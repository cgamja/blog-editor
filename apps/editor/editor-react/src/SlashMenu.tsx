import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  applySlashItem,
  clearSlashQuery,
  slashActionGap,
  slashMenuKey,
} from "@blog-editor/editor-core";
import type { SlashMenuState } from "@blog-editor/editor-core";
import type { BlockMenuAction } from "./block-menu-actions";
import { SLASH_MENU_MESSAGES } from "./messages";
import { SELECTION_POPUP_GAP_PX } from "./popup-constants";
import { filterSlashItems, isAction, slashItemLabel } from "./slash-items";
import type { SlashItem } from "./slash-items";
import { useCommandRunner } from "./use-command-runner";
import { useSlashMenuAutoClose } from "./use-slash-menu-auto-close";
import { useSlashMenuKeys } from "./use-slash-menu-keys";

export interface SlashMenuProps {
  editor: Editor;
  /** 목록 좌표의 기준(BlogEditor 바깥 틀, position: relative) */
  frameRef: RefObject<HTMLDivElement | null>;
  /** 쓸 수 있는 동작 항목과 그 동작 — 결과를 넣을 최상위 자리(gap)를 받는다. 없는 동작은 목록에서 빠진다 */
  actions?: Partial<Record<BlockMenuAction, (gap: number) => void>> | undefined;
}

interface Position {
  top: number;
  left: number;
}

const sameMenu = (a: SlashMenuState | null, b: SlashMenuState | null) =>
  a?.from === b?.from && a?.query === b?.query;

/**
 * `/` 슬래시 메뉴(spec: editor-slash-menu). 편집 영역에 포커스를 둔 채 쓰는 listbox다 — 포커스를 옮기면 조합 중인
 * 한글 · 선택이 끊기므로, contenteditable에 `aria-controls` · `aria-activedescendant`를 달아 고른 항목을 알린다
 * (APG combobox, https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
 */
const NO_ACTIONS: Partial<Record<BlockMenuAction, (gap: number) => void>> = {};

export function SlashMenu({ editor, frameRef, actions = NO_ACTIONS }: SlashMenuProps) {
  const run = useCommandRunner(editor);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const menu = useEditorState({
    editor,
    selector: ({ editor: current }) => slashMenuKey.getState(current.state) ?? null,
    equalityFn: sameMenu,
  });
  const query = menu?.query ?? null;
  const available = useMemo(
    () => (Object.keys(actions) as BlockMenuAction[]).filter((action) => actions[action]),
    [actions],
  );
  const items = useMemo(
    () => (query === null ? [] : filterSlashItems(query, available)),
    [query, available],
  );
  const optionId = (item: SlashItem) => `${listId}-${item}`;
  const position = useSlashMenuPosition(editor, frameRef, menu?.from ?? null, query);

  const choose = useCallback(
    (item: SlashItem) => {
      if (!isAction(item)) {
        run(applySlashItem(item));
        return;
      }
      // 동작 항목은 /거르기를 지운 자리를 먼저 재 두고, 글자를 지운 뒤 동작(파일 고르기)을 부른다
      const gap = slashActionGap(editor.state);
      if (gap !== null && run(clearSlashQuery)) actions[item]?.(gap);
    },
    [actions, editor, run],
  );
  const { current } = useSlashMenuKeys(editor, query, items, choose);
  useSlashMenuAutoClose(editor, query, items.length);

  useComboboxAttributes(
    editor,
    current === undefined ? null : listId,
    current && optionId(current),
  );

  useScrollActiveOptionIntoView(listRef, current && optionId(current));

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
      {items.map((item) => (
        <div
          key={item}
          id={optionId(item)}
          role="option"
          tabIndex={-1}
          aria-selected={item === current}
          // 누르는 순간 고른다 — mousedown을 막아 편집 영역 포커스와 선택이 그대로 남는다
          onMouseDown={(event) => {
            event.preventDefault();
            choose(item);
          }}
        >
          {slashItemLabel(item)}
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

/**
 * 고른 항목이 목록 밖이면 보이게 스크롤한다 — 가장 가까운 만큼만.
 * https://developer.mozilla.org/docs/Web/API/Element/scrollIntoView
 */
function useScrollActiveOptionIntoView(
  listRef: RefObject<HTMLDivElement | null>,
  activeId: string | undefined,
): void {
  useLayoutEffect(() => {
    if (activeId === undefined) return;
    listRef.current?.querySelector(`[id="${activeId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [listRef, activeId]);
}
