import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { toolbarPlacement } from "./text-toolbar-model";

export interface ToolbarAnchor {
  top: number;
  left: number;
  below: boolean;
}

// 선택 글자와 도구줄 사이 — 링크 팝오버(use-link-shortcut)와 같은 간격
const TOOLBAR_GAP_PX = 8;

const SCROLLING = /(auto|scroll)/;

/** 도구줄이 보일 수 있는 위쪽 끝(화면 좌표) — 가장 가까운 세로 스크롤 상자의 위, 없으면 창 위 */
function visibleTopOf(element: HTMLElement): number {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (SCROLLING.test(getComputedStyle(node).overflowY)) {
      return Math.max(0, node.getBoundingClientRect().top);
    }
  }
  return 0;
}

/**
 * 글자 서식 도구줄의 자리(기준 틀 안 좌표). 선택 위, 보이는 영역 위쪽에 자리가 없으면 선택 아래(design.md 7).
 * 가로는 선택 시작 글자에 맞추되 틀 밖으로 나가지 않게 당긴다.
 * 트랜잭션 · 안쪽 스크롤 상자의 스크롤(capture) · 창 크기가 바뀔 때마다 다시 잰다(폭 도구줄과 같다).
 */
export function useTextToolbarAnchor(
  editor: Editor,
  frameRef: RefObject<HTMLDivElement | null>,
  toolbarRef: RefObject<HTMLDivElement | null>,
  visible: boolean,
): ToolbarAnchor | null {
  const [anchor, setAnchor] = useState<ToolbarAnchor | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!visible || frame === null) return undefined;
    function measure() {
      const toolbar = toolbarRef.current;
      if (frame === null || toolbar === null) return;
      const { from, to } = editor.state.selection;
      // https://prosemirror.net/docs/ref/#view.EditorView.coordsAtPos
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const origin = frame.getBoundingClientRect();
      const placement = toolbarPlacement({
        selectionTop: Math.min(start.top, end.top) - origin.top,
        selectionBottom: Math.max(start.bottom, end.bottom) - origin.top,
        toolbarHeight: toolbar.offsetHeight,
        gap: TOOLBAR_GAP_PX,
        boundaryTop: visibleTopOf(frame) - origin.top,
      });
      const widest = Math.max(0, origin.width - toolbar.offsetWidth);
      setAnchor({
        ...placement,
        left: Math.min(Math.max(0, start.left - origin.left), widest),
      });
    }
    measure();
    // TipTap은 뷰가 새 상태를 그린 뒤 transaction 이벤트를 낸다 — https://tiptap.dev/docs/editor/api/events#transaction
    editor.on("transaction", measure);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    window.addEventListener("resize", measure);
    return () => {
      editor.off("transaction", measure);
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [editor, frameRef, toolbarRef, visible]);

  return visible ? anchor : null;
}
