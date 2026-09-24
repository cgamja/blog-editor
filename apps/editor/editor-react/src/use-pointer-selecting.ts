import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

/**
 * 편집 영역에서 마우스로 끌어 고르는 중인가 — 주 버튼을 누른 뒤 뗄 때까지. 도구줄은 이 동안 숨고
 * 뗀 뒤에 뜬다(Notion과 같다). 키보드 선택(Shift+방향키)은 이 값을 건드리지 않는다.
 * 떼는 곳이 편집 영역 밖일 수 있어 pointerup은 창에서 받는다.
 * https://developer.mozilla.org/docs/Web/API/Element/pointerdown_event
 */
export function usePointerSelecting(editor: Editor): boolean {
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    const dom = editor.view.dom;
    const start = (event: PointerEvent) => {
      if (event.button === 0) setSelecting(true);
    };
    const end = () => setSelecting(false);
    dom.addEventListener("pointerdown", start);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      dom.removeEventListener("pointerdown", start);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [editor]);

  return selecting;
}
