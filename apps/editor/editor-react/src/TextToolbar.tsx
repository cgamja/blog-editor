import { useCallback, useMemo, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent, RefObject } from "react";
import { TextSelection } from "@tiptap/pm/state";
import { useEditorState, type Editor } from "@tiptap/react";
import { TOOLBAR_MARKS, textStyleSummary, toggleToolbarMark } from "@blog-editor/editor-core";
import type { ToolbarMark } from "@blog-editor/editor-core";
import { tabIndexAfterKey } from "./screen-tabs";
import { MARK_LABELS, textToolbarMessages } from "./text-toolbar-messages";
import { TextStyleControls } from "./TextStyleControls";
import type { TextStyleMenu, ToolbarItemProps } from "./TextStyleControls";
import { useCommandRunner } from "./use-command-runner";
import { useCloseOnOutsidePointer } from "./use-dismiss";
import { OPEN_LINK_EVENT } from "./use-link-shortcut";
import { useTextToolbarAnchor } from "./use-text-toolbar-anchor";

export interface TextToolbarProps {
  editor: Editor;
  /** 도구줄 좌표의 기준(BlogEditor 바깥 틀, position: relative) */
  frameRef: RefObject<HTMLDivElement | null>;
}

const MENUS: readonly TextStyleMenu[] = ["font", "weight", "size", "color", "highlight"];
const LINK_ITEM = "link";
/** 로빙 tabindex 순서 — 마크 버튼 · 링크 · 드롭다운 · 색 */
const ITEM_ORDER: readonly string[] = [...TOOLBAR_MARKS, LINK_ITEM, ...MENUS];

/** 글자 서식 도구줄에서 글자를 보여 주는 마크 버튼 모양 — text-toolbar.css가 data-mark로 꾸민다 */
const MARK_GLYPHS: Record<ToolbarMark, string> = {
  bold: "가",
  italic: "가",
  underline: "가",
  strike: "가",
  code: "</>",
};

/**
 * 글자를 고르면 선택 위에 뜨는 서식 도구줄(디자인 68:2 인라인 툴바를 넓혔다, spec: editor-text-style).
 * APG toolbar — 한 칸만 Tab으로 들어오고 ←/→ · Home/End로 옮긴다. 버튼은 누를 때 편집 영역의 선택을
 * 빼앗지 않는다. 한글 조합 중에는 감춘다(.claude/rules/editor.md).
 * https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
 */
export function TextToolbar({ editor, frameRef }: TextToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      summary: textStyleSummary(current.state),
      isText: current.state.selection instanceof TextSelection,
      focused: current.isFocused,
      composing: current.view.composing,
      editable: current.isEditable,
    }),
  });
  const run = useCommandRunner(editor);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [active, setActive] = useState(0);
  const [openMenu, setOpenMenu] = useState<TextStyleMenu | null>(null);
  const [hasFocus, setHasFocus] = useState(false);

  const visible =
    state.summary.canStyle &&
    state.isText &&
    !state.composing &&
    state.editable &&
    (state.focused || hasFocus);
  const anchor = useTextToolbarAnchor(editor, frameRef, toolbarRef, visible);
  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const insideRefs = useMemo(() => [toolbarRef], []);
  useCloseOnOutsidePointer(openMenu !== null, insideRefs, closeMenu);

  if (!visible) return null;

  const itemProps = (name: string): ToolbarItemProps => ({
    tabIndex: ITEM_ORDER.indexOf(name) === active ? 0 : -1,
    registerButton: (button) => {
      if (button === null) buttons.current.delete(name);
      else buttons.current.set(name, button);
    },
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = ITEM_ORDER.findIndex((name) => buttons.current.get(name) === event.target);
    const next = index < 0 ? null : tabIndexAfterKey(index, event.key, ITEM_ORDER.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    buttons.current.get(ITEM_ORDER[next]!)?.focus();
  };

  // 누를 때 편집 영역의 선택 · 포커스를 지킨다 — 입력 칸만 포커스를 받는다(폭 도구줄과 같다)
  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (toolbarRef.current?.contains(event.relatedTarget as Node | null)) return;
    setHasFocus(false);
    closeMenu();
  };

  const linkItem = itemProps(LINK_ITEM);
  const openLink = () => frameRef.current?.dispatchEvent(new CustomEvent(OPEN_LINK_EVENT));

  return (
    <div
      ref={toolbarRef}
      className="text-toolbar"
      role="toolbar"
      aria-label={textToolbarMessages.label}
      data-below={anchor?.below ? "" : undefined}
      style={anchor === null ? { visibility: "hidden" } : { top: anchor.top, left: anchor.left }}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onFocus={() => setHasFocus(true)}
      onBlur={handleBlur}
    >
      {TOOLBAR_MARKS.map((mark) => {
        const { tabIndex, registerButton } = itemProps(mark);
        return (
          <button
            key={mark}
            ref={registerButton}
            type="button"
            tabIndex={tabIndex}
            aria-label={MARK_LABELS[mark]}
            aria-pressed={state.summary.marks[mark]}
            data-mark={mark}
            onClick={() => run(toggleToolbarMark(mark))}
          >
            {MARK_GLYPHS[mark]}
          </button>
        );
      })}
      <button
        ref={linkItem.registerButton}
        type="button"
        tabIndex={linkItem.tabIndex}
        data-mark={LINK_ITEM}
        onClick={openLink}
      >
        {textToolbarMessages.link}
      </button>
      <span className="text-toolbar-divider" aria-hidden="true" />
      <TextStyleControls
        summary={state.summary}
        openMenu={openMenu}
        onOpenMenuChange={setOpenMenu}
        run={run}
        itemProps={itemProps}
      />
    </div>
  );
}
