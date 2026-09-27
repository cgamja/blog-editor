import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";

export interface BlockAnchor {
  left: number;
  top: number;
}

/**
 * pos 블록 위 가운데 자리 — 떠 있는 도구줄(폭 도구줄 · 사진 자리 도구줄)이 쓴다. 자리는 도구줄의 offsetParent 기준이다.
 * 잴 때마다 블록 DOM을 다시 구한다 — 같은 블록이라도 속성(폭 · 움직임 · 스티커)이 바뀌면 ProseMirror가 DOM을 새로
 * 그리므로, 옛 DOM을 붙잡으면 도구줄이 튄다. 트랜잭션 · 크기 변화(이미지 로드 · 창 크기) · 안쪽 스크롤 상자의
 * 스크롤(capture — scroll은 버블링하지 않는다)마다 다시 잰다. pos가 null이면 재지 않는다.
 */
export function useBlockAnchor(
  editor: Editor,
  pos: number | null,
  toolbarRef: RefObject<HTMLElement | null>,
): BlockAnchor | null {
  const [anchor, setAnchor] = useState<BlockAnchor | null>(null);

  useLayoutEffect(() => {
    if (pos === null) return undefined;
    const offsetParent = toolbarRef.current?.offsetParent;
    if (!(offsetParent instanceof HTMLElement)) return undefined;
    const frame = offsetParent;
    let block: HTMLElement | null = null;
    // https://developer.mozilla.org/docs/Web/API/ResizeObserver
    const observer = new ResizeObserver(() => measure());
    function measure() {
      // https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM
      const current = editor.view.nodeDOM(pos ?? 0);
      const next = current instanceof HTMLElement ? current : null;
      if (next !== block) {
        if (block !== null) observer.unobserve(block);
        if (next !== null) observer.observe(next);
        block = next;
      }
      if (block === null) return;
      const blockRect = block.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      setAnchor({
        left: blockRect.left - frameRect.left + blockRect.width / 2,
        top: blockRect.top - frameRect.top,
      });
    }
    observer.observe(frame);
    measure();
    // TipTap은 뷰가 새 상태를 그린 뒤 transaction 이벤트를 낸다 — https://tiptap.dev/docs/editor/api/events#transaction
    editor.on("transaction", measure);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      editor.off("transaction", measure);
      window.removeEventListener("scroll", measure, { capture: true });
    };
  }, [editor, pos, toolbarRef]);

  return anchor;
}
