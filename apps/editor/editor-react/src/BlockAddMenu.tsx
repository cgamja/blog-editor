import { useCallback, useEffect, useMemo, useRef } from "react";
import type { FocusEvent } from "react";
import { INSERTABLE_BLOCKS } from "@blog-editor/editor-core";
import type { InsertableBlockKind } from "@blog-editor/editor-core";
import { menuItemsOf, onMenuKeyDown } from "./menu-keys";
import { BLOCK_MENU_ACTIONS } from "./block-menu-actions";
import type { BlockMenuAction } from "./block-menu-actions";
import {
  BLOCK_HANDLE_MESSAGES,
  BLOCK_MENU_ACTION_LABELS,
  INSERTABLE_BLOCK_LABELS,
} from "./messages";
import { useCloseOnOutsidePointer } from "./use-dismiss";
import { useMenuPlacement, useScrollMenuIntoView } from "./use-menu-placement";

const KINDS = Object.keys(INSERTABLE_BLOCKS) as InsertableBlockKind[];

export interface BlockAddMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (kind: InsertableBlockKind) => void;
  /** 동작 항목(이미지 고르기 등) — 블록 종류 뒤에 슬래시 메뉴와 같은 순서로 붙는다. 없는 동작은 항목도 없다 */
  actions?: Partial<Record<BlockMenuAction, () => void>> | undefined;
}

/**
 * 「블록 추가」 버튼과 메뉴(role=menu). 방향키 · Home/End로 항목을 옮기고, Enter로 고르며, Esc로 닫고
 * + 버튼으로 포커스를 돌린다. 메뉴 밖을 누르거나 Tab으로 포커스가 나가면 닫힌다.
 * https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 */
export function BlockAddMenu({ open, onOpenChange, onChoose, actions }: BlockAddMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const insideRefs = useMemo(() => [buttonRef, menuRef], []);
  useCloseOnOutsidePointer(open, insideRefs, close);
  const { placement, needsScroll } = useMenuPlacement(menuRef, open);
  useScrollMenuIntoView(menuRef, needsScroll);

  // APG menu-button 패턴: 메뉴를 열면 포커스는 첫 항목으로 간다 — 방향키 탐색이 거기서 시작한다
  useEffect(() => {
    if (open) menuItemsOf(menuRef.current)[0]?.focus();
  }, [open]);

  const closeToButton = () => {
    close();
    buttonRef.current?.focus();
  };

  // React onBlur는 부모로 버블된다(focusout)
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    // + 버튼으로 옮기는 포커스는 버튼의 토글이 처리한다 — 여기서 닫으면 click이 다시 연다
    if (menuRef.current?.contains(next) || buttonRef.current?.contains(next)) return;
    close();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="block-handle-add"
        aria-label={BLOCK_HANDLE_MESSAGES.add}
        aria-haspopup="menu"
        aria-expanded={open}
        // Safari는 누른 버튼에 포커스를 주지 않아 relatedTarget이 null이다 — 포커스를 메뉴에 둔 채 토글한다
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onOpenChange(!open)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          className="block-add-menu"
          data-placement={placement}
          role="menu"
          aria-label={BLOCK_HANDLE_MESSAGES.add}
          tabIndex={-1}
          onKeyDown={(event) => onMenuKeyDown(event, menuRef.current, closeToButton)}
          onBlur={onBlur}
        >
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => onChoose(kind)}
            >
              {INSERTABLE_BLOCK_LABELS[kind]}
            </button>
          ))}
          {BLOCK_MENU_ACTIONS.map((action) => {
            const handle = actions?.[action];
            return (
              handle !== undefined && (
                <button key={action} type="button" role="menuitem" tabIndex={-1} onClick={handle}>
                  {BLOCK_MENU_ACTION_LABELS[action]}
                </button>
              )
            );
          })}
        </div>
      )}
    </>
  );
}
