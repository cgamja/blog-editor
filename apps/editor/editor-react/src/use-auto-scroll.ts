import { useEffect, useEffectEvent } from "react";
import type { RefObject } from "react";
import { autoScrollStep, scrollContainerOf, visibleBoxOf } from "./block-geometry";

/**
 * 켜져 있는 동안 포인터가 스크롤 상자 가장자리에 있으면 매 프레임 스크롤한다(block-controls design.md 4).
 * 스크롤하면 `onScrolled`로 알린다 — 같은 포인터 자리라도 놓일 자리 · 잔상 좌표가 바뀐다.
 * https://developer.mozilla.org/docs/Web/API/Window/requestAnimationFrame
 */
export function useAutoScroll(
  anchor: HTMLElement | null,
  pointerYRef: RefObject<number>,
  onScrolled: () => void,
): void {
  const notifyScrolled = useEffectEvent(onScrolled);

  useEffect(() => {
    if (anchor === null) return undefined;
    const scroller = scrollContainerOf(anchor);
    let frame = 0;
    const tick = () => {
      const step = autoScrollStep(pointerYRef.current, visibleBoxOf(scroller));
      if (step !== 0) {
        const before = scroller.scrollTop;
        scroller.scrollTop = before + step;
        if (scroller.scrollTop !== before) notifyScrolled();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [anchor, pointerYRef]);
}
