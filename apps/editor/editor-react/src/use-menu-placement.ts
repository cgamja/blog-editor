import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { scrollContainerOf, visibleBoxOf } from "./block-geometry";

export type MenuPlacement = "below" | "above";

export interface MenuLayout {
  placement: MenuPlacement;
  /** 위아래 어느 쪽에도 다 들어가지 않는다 — 부르는 쪽이 메뉴가 보이게 스크롤한다 */
  needsScroll: boolean;
}

const BELOW: MenuLayout = { placement: "below", needsScroll: false };

/**
 * 손잡이 메뉴를 펼칠 방향(Notion과 같다). 아래에 들어가면 아래, 아니고 위에 들어가면 위로 펼친다.
 * 둘 다 모자라면 아래로 펼치고 `needsScroll`로 알린다 — 넘친 메뉴 항목은 보이지도 눌리지도 않는다
 * (block-controls 실브라우저 확인). 열린 뒤 한 번 잰다. 재기만 하고 화면은 건드리지 않는다.
 */
export function useMenuPlacement(
  menuRef: RefObject<HTMLElement | null>,
  open: boolean,
): MenuLayout {
  const [layout, setLayout] = useState<MenuLayout>(BELOW);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || menu === null) {
      setLayout(BELOW);
      return;
    }
    const box = visibleBoxOf(scrollContainerOf(menu));
    const rect = menu.getBoundingClientRect();
    const anchorTop = menu.offsetParent?.getBoundingClientRect().top ?? rect.top;
    const fitsBelow = rect.bottom <= box.bottom;
    const fitsAbove = rect.height <= anchorTop - box.top;
    if (!fitsBelow && fitsAbove) setLayout({ placement: "above", needsScroll: false });
    else setLayout({ placement: "below", needsScroll: !fitsBelow });
  }, [menuRef, open]);

  return layout;
}

/**
 * 메뉴가 넘치면 보이게 스크롤한다 — 가장 가까운 만큼만(block: nearest).
 * https://developer.mozilla.org/docs/Web/API/Element/scrollIntoView
 */
export function useScrollMenuIntoView(
  menuRef: RefObject<HTMLElement | null>,
  needsScroll: boolean,
): void {
  useLayoutEffect(() => {
    if (needsScroll) menuRef.current?.scrollIntoView({ block: "nearest" });
  }, [menuRef, needsScroll]);
}
