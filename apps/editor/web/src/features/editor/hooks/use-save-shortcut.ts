import { useEffect, useRef } from "react";
import { isSaveShortcut } from "../autosave";

/** ⌘S · Ctrl+S — 브라우저의 "페이지 저장" 대신 글을 저장한다. 입력 칸 · 본문 어디에 포커스가 있어도 된다 */
export function useSaveShortcut(onSave: () => void): void {
  const latest = useRef(onSave);
  latest.current = onSave;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSaveShortcut(event)) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
