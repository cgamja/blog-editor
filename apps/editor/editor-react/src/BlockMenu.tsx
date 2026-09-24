import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { Command } from "@tiptap/pm/state";
import {
  atTopBlock,
  deleteTopBlock,
  duplicateTopBlock,
  TURN_INTO_TARGETS,
  turnTopBlockInto,
} from "@blog-editor/editor-core";
import type { TurnIntoKind } from "@blog-editor/editor-core";
import { menuItemsOf, onMenuKeyDown } from "./menu-keys";
import { BLOCK_MENU_MESSAGES, TURN_INTO_LABELS } from "./messages";
import { useCloseOnOutsidePointer } from "./use-dismiss";
import { useMenuPlacement, useScrollMenuIntoView } from "./use-menu-placement";

const KINDS = Object.keys(TURN_INTO_TARGETS) as TurnIntoKind[];

export interface BlockMenuProps {
  editor: Editor;
  /** 메뉴를 연 손잡이의 최상위 블록 번호 */
  index: number;
  onClose: () => void;
  /** 메뉴 버튼(옮기기 손잡이) — Esc로 닫으면 포커스를 돌려준다 */
  buttonRef: RefObject<HTMLButtonElement | null>;
  onRun: (command: Command) => void;
}

/**
 * 손잡이를 누르면 여는 블록 메뉴(Notion의 블록 메뉴) — 바꾸기 · 복제 · 지우기. 커맨드는 모두 손잡이 블록에
 * 작동한다(editor-core atTopBlock, block-controls design.md 5). 바꿀 수 없는 항목은 aria-disabled다 —
 * APG는 비활성 메뉴 항목도 포커스를 받게 둔다. https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 */
export function BlockMenu({ editor, index, onClose, buttonRef, onRun }: BlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const insideRefs = useMemo(() => [buttonRef, menuRef], [buttonRef]);
  useCloseOnOutsidePointer(true, insideRefs, onClose);
  const { placement, needsScroll } = useMenuPlacement(menuRef, true);
  useScrollMenuIntoView(menuRef, needsScroll);

  // 열 때 한 번만 잰다 — 메뉴가 포커스를 가진 동안 문서는 메뉴 항목으로만 바뀌고, 고르면 메뉴가 닫힌다.
  // 트랜잭션마다 다시 재면 항목마다 선택만 옮긴 EditorState를 새로 만든다(atTopBlock)
  const [enabledKinds] = useState(() =>
    KINDS.filter((kind) => turnTopBlockInto(index, kind)(editor.state)),
  );

  // APG menu-button 패턴: 메뉴를 열면 포커스는 첫 항목으로 간다 — 방향키 탐색이 거기서 시작한다
  useEffect(() => {
    menuItemsOf(menuRef.current)[0]?.focus();
  }, []);

  const closeToButton = useCallback(() => {
    onClose();
    buttonRef.current?.focus();
  }, [onClose, buttonRef]);

  // React onBlur는 부모로 버블된다(focusout)
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (menuRef.current?.contains(next) || buttonRef.current?.contains(next)) return;
    onClose();
  };

  const choose = (command: Command) => {
    // 한글 조합 중에는 문서를 바꾸지 않는다 — 메뉴를 열어 둔 채 미룬다(.claude/rules/editor.md)
    if (editor.view.composing) return;
    onClose();
    onRun(command);
  };

  return (
    <div
      ref={menuRef}
      className="block-menu"
      data-placement={placement}
      role="menu"
      aria-label={BLOCK_MENU_MESSAGES.menu}
      tabIndex={-1}
      onKeyDown={(event) => onMenuKeyDown(event, menuRef.current, closeToButton)}
      onBlur={onBlur}
    >
      <div role="group" aria-label={BLOCK_MENU_MESSAGES.turnInto}>
        <div className="block-menu-heading" aria-hidden="true">
          {BLOCK_MENU_MESSAGES.turnInto}
        </div>
        {KINDS.map((kind) => {
          const enabled = enabledKinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={!enabled || undefined}
              onClick={() => enabled && choose(turnTopBlockInto(index, kind))}
            >
              {TURN_INTO_LABELS[kind]}
            </button>
          );
        })}
      </div>
      <div role="separator" className="block-menu-separator" />
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={() => choose(atTopBlock(index, duplicateTopBlock))}
      >
        {BLOCK_MENU_MESSAGES.duplicate}
      </button>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={() => choose(deleteTopBlock(index))}
      >
        {BLOCK_MENU_MESSAGES.remove}
      </button>
    </div>
  );
}
