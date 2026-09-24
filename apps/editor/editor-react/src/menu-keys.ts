import type { KeyboardEvent } from "react";

/**
 * 손잡이 메뉴(블록 추가 · 블록 메뉴)가 함께 쓰는 APG menu 키 처리 —
 * https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 */

export const menuItemsOf = (menu: HTMLElement | null) => [
  ...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
];

/**
 * 방향키 · Home/End로 항목 사이를 옮기고, Esc면 onEscape. 처리한 키는 기본 동작을 막는다.
 * 비활성(aria-disabled) 항목도 포커스는 받는다 — APG는 비활성 메뉴 항목을 건너뛰지 않는다.
 */
export function onMenuKeyDown(
  event: KeyboardEvent<HTMLElement>,
  menu: HTMLElement | null,
  onEscape: () => void,
): void {
  const items = menuItemsOf(menu);
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
    onEscape();
  }
}
