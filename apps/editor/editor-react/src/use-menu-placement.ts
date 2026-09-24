import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { scrollContainerOf, visibleBoxOf } from "./block-geometry";

export type MenuPlacement = "below" | "above";

/**
 * 손잡이 메뉴를 펼칠 방향(Notion과 같다). 아래에 들어가면 아래, 아니고 위에 들어가면 위로 펼친다.
 * 둘 다 모자라면 아래로 펼치고 스크롤 상자를 메뉴가 다 보이는 만큼만 스크롤한다 — 넘친 메뉴 항목은
 * 보이지도 눌리지도 않는다(block-controls 실브라우저 확인). 열린 뒤 한 번 잰다.
 * https://developer.mozilla.org/docs/Web/API/Element/scrollIntoView
 */
export function useMenuPlacement(
  menuRef: RefObject<HTMLElement | null>,
  open: boolean,
): MenuPlacement {
  const [placement, setPlacement] = useState<MenuPlacement>("below");

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || menu === null) {
      setPlacement("below");
      return;
    }
    const box = visibleBoxOf(scrollContainerOf(menu));
    const rect = menu.getBoundingClientRect();
    const anchorTop = menu.offsetParent?.getBoundingClientRect().top ?? rect.top;
    const fitsBelow = rect.bottom <= box.bottom;
    const fitsAbove = rect.height <= anchorTop - box.top;
    if (!fitsBelow && fitsAbove) {
      setPlacement("above");
      return;
    }
    setPlacement("below");
    if (!fitsBelow) menu.scrollIntoView({ block: "nearest" });
  }, [menuRef, open]);

  return placement;
}
