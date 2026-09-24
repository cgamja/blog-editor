import { useEffect } from "react";
import type { RefObject } from "react";

/** 켜져 있는 동안 문서 어디서든 Esc를 누르면 onEscape. */
export function useEscapeKey(enabled: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, onEscape]);
}

/** 켜져 있는 동안 refs 바깥을 누르면 onOutside. */
export function useCloseOnOutsidePointer(
  enabled: boolean,
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!refs.some((ref) => ref.current?.contains(target))) onOutside();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [enabled, refs, onOutside]);
}
