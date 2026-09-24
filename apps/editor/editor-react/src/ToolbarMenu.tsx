import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { ToolbarItemProps, ToolbarMenuOption } from "./text-toolbar-types";

/** 메뉴가 보여 줄 값 */
export interface ToolbarMenuContent {
  /** 무엇을 고르는 메뉴인가 — 접근성 이름의 앞부분 */
  label: string;
  /** 지금 값의 이름 — 여러 값이면 "여러 값" */
  current: string;
  options: readonly ToolbarMenuOption[];
  /** 지금 값 — 없으면 null, 여러 값이면 undefined */
  selected: string | null | undefined;
}

export interface ToolbarMenuProps {
  menu: ToolbarMenuContent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (value: string | null) => void;
  /** 고를 수 없는 이유 — 있으면 버튼을 막고 설명으로 잇는다 */
  disabledReason?: string | null;
  /** 도구줄의 로빙 칸 */
  item: ToolbarItemProps;
}

const menuItemsOf = (menu: HTMLElement | null) => [
  ...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []),
];

// 메뉴 안 방향키 이동 — 끝에서 반대쪽 끝으로 돈다
const MENU_KEYS: Record<string, (current: number, count: number) => number> = {
  ArrowDown: (current, count) => (current + 1) % count,
  ArrowUp: (current, count) => (current - 1 + count) % count,
  Home: () => 0,
  End: (_current, count) => count - 1,
};

/**
 * 도구줄 안 드롭다운(글꼴 · 두께 · 크기). 메뉴 버튼 패턴 — 열면 고른 항목(없으면 첫 항목)에 포커스,
 * 방향키 · Home/End로 옮기고 Enter로 고르며 Esc로 닫는다. 고르거나 닫으면 포커스는 메뉴 버튼으로
 * 돌아간다 — 포커스가 사라지면 도구줄도 닫혀 다음 서식을 이어 걸 수 없다.
 * https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 */
export function ToolbarMenu({
  menu: { label, current, options, selected },
  open,
  onOpenChange,
  onChoose,
  disabledReason = null,
  item,
}: ToolbarMenuProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const reasonId = useId();
  const disabled = disabledReason !== null;

  // APG menu-button 패턴: 열면 포커스가 메뉴 항목으로 간다 — 방향키 탐색이 거기서 시작한다
  useEffect(() => {
    if (!open) return;
    const items = menuItemsOf(menuRef.current);
    const checked = items.find((element) => element.getAttribute("aria-checked") === "true");
    (checked ?? items[0])?.focus();
  }, [open]);

  const closeToButton = () => {
    onOpenChange(false);
    buttonRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // 도구줄의 ←/→ 이동이 메뉴 안 키를 가로채지 않게 한다
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      closeToButton();
      return;
    }
    if (event.key === "Tab") {
      onOpenChange(false);
      return;
    }
    const move = MENU_KEYS[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const items = menuItemsOf(menuRef.current);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    items[move(index, items.length)]?.focus();
  };

  return (
    <div className="text-toolbar-menu">
      <button
        ref={(button) => {
          buttonRef.current = button;
          item.registerButton(button);
        }}
        type="button"
        tabIndex={item.tabIndex}
        aria-label={`${label}: ${current}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-disabled={disabled || undefined}
        aria-describedby={disabled ? reasonId : undefined}
        title={disabledReason ?? undefined}
        onClick={() => {
          if (!disabled) onOpenChange(!open);
        }}
      >
        {selected === null ? label : current}
      </button>
      {disabled && (
        <span id={reasonId} hidden>
          {disabledReason}
        </span>
      )}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="text-toolbar-popup"
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          {options.map((option) => (
            <button
              key={option.value ?? "none"}
              type="button"
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={selected === option.value}
              data-preview-font={option.previewFont}
              onClick={() => {
                onChoose(option.value);
                closeToButton();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
