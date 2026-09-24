import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { SELECTION_POPUP_GAP_PX } from "./popup-constants";
import { toolbarPlacement } from "./text-toolbar-model";

export interface ToolbarAnchor {
  top: number;
  left: number;
  below: boolean;
}

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
 * 트랜잭션 · 안쪽 스크롤 상자의 스크롤(capture) · 창 크기 · 도구줄과 틀의 크기(라벨이 바뀌어 폭이 달라질 때)가
 * 바뀔 때마다 다시 잰다(폭 도구줄과 같다).
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
      // offsetWidth · offsetHeight는 정수로 반올림돼 오른쪽 끝에서 소수 px만큼 틀 밖으로 나간다 — 소수까지 잰다
      const size = toolbar.getBoundingClientRect();
      const placement = toolbarPlacement({
        selectionTop: Math.min(start.top, end.top) - origin.top,
        selectionBottom: Math.max(start.bottom, end.bottom) - origin.top,
        toolbarHeight: size.height,
        gap: SELECTION_POPUP_GAP_PX,
        boundaryTop: visibleTopOf(frame) - origin.top,
      });
      const widest = Math.max(0, origin.width - size.width);
      setAnchor({
        ...placement,
        left: Math.min(Math.max(0, start.left - origin.left), widest),
      });
    }
    // https://developer.mozilla.org/docs/Web/API/ResizeObserver
    const observer = new ResizeObserver(() => measure());
    observer.observe(frame);
    if (toolbarRef.current !== null) observer.observe(toolbarRef.current);
    measure();
    // TipTap은 뷰가 새 상태를 그린 뒤 transaction 이벤트를 낸다 — https://tiptap.dev/docs/editor/api/events#transaction
    editor.on("transaction", measure);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      editor.off("transaction", measure);
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [editor, frameRef, toolbarRef, visible]);

  return visible ? anchor : null;
}
