import { useCallback, useEffect, useMemo, useRef } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import { INSERTABLE_BLOCKS } from "@blog-editor/editor-core";
import type { InsertableBlockKind } from "@blog-editor/editor-core";
import { BLOCK_HANDLE_MESSAGES, INSERTABLE_BLOCK_LABELS } from "./messages";
import { useCloseOnOutsidePointer } from "./use-dismiss";

const KINDS = Object.keys(INSERTABLE_BLOCKS) as InsertableBlockKind[];

export interface BlockAddMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (kind: InsertableBlockKind) => void;
}

const menuItemsOf = (menu: HTMLElement | null) => [
  ...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
];

/**
 * 「블록 추가」 버튼과 메뉴(role=menu). 방향키 · Home/End로 항목을 옮기고, Enter로 고르며, Esc로 닫고
 * + 버튼으로 포커스를 돌린다. 메뉴 밖을 누르거나 Tab으로 포커스가 나가면 닫힌다.
 * https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 */
export function BlockAddMenu({ open, onOpenChange, onChoose }: BlockAddMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const insideRefs = useMemo(() => [buttonRef, menuRef], []);
  useCloseOnOutsidePointer(open, insideRefs, close);

  // 열리면 첫 항목에 포커스
  useEffect(() => {
    if (open) menuItemsOf(menuRef.current)[0]?.focus();
  }, [open]);

  const closeToButton = () => {
    close();
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItemsOf(menuRef.current);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const targets: Record<string, number | undefined> = {
      ArrowDown: (current + 1) % items.length,
      ArrowUp: (current - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const target = targets[event.key];
    if (target !== undefined) {
      event.preventDefault();
      items[target]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeToButton();
    }
  };

  // Tab 등으로 포커스가 메뉴 밖으로 나가면 닫는다(focusout)
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!menuRef.current?.contains(event.relatedTarget as Node | null)) close();
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
          role="menu"
          aria-label={BLOCK_HANDLE_MESSAGES.add}
          tabIndex={-1}
          onKeyDown={onKeyDown}
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
        </div>
      )}
    </>
  );
}
