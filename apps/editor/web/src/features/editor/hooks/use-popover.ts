import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 버튼 하나가 여닫는 비모달 팝오버 — 열면 팝오버로 포커스를 옮기고, Esc는 닫고 버튼으로 포커스를 돌려준다.
 * 바깥(버튼 · 팝오버 밖)을 누르면 닫는다. WAI-ARIA APG Disclosure + Dialog(non-modal) 관용
 * https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ (Esc · 포커스 되돌림)
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    popoverRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return { open, toggle: () => setOpen((value) => !value), close, buttonRef, popoverRef };
}
