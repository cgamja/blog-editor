import { useCallback, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { Node } from "@tiptap/pm/model";
import { blockStart, dropGapAt } from "@blog-editor/editor-core";
import { dropLineTop, measureBlocks } from "./block-geometry";
import { useAutoScroll } from "./use-auto-scroll";
import { useEscapeKey } from "./use-dismiss";

/** 이만큼 넘게 움직이면 끌기, 그 전에 떼면 누르기(블록 메뉴) — 누를 때의 손 떨림보다 크게(design.md 2) */
const DRAG_THRESHOLD_PX = 4;

interface Press {
  x: number;
  y: number;
}

/** 끄는 동안 그리는 것 — 모두 틀(frame) 기준 좌표 */
interface DragView {
  gap: number;
  lineTop: number;
  ghostTop: number;
}

export interface BlockDrag extends DragView {
  from: number;
  /** 끌기를 시작할 때의 문서 — 끄는 사이 문서가 바뀌면 번호가 틀리므로 놓지 않는다 */
  doc: Node;
  /** 선 · 잔상을 그릴 틀 — 렌더 중에 ref를 읽지 않도록 시작할 때 잡아 둔다 */
  frameEl: HTMLElement;
  /** 블록 DOM 복제본(잔상) — ProseMirror DOM은 건드리지 않는다(design.md 3) */
  ghost: HTMLElement;
  ghostLeft: number;
  ghostWidth: number;
  /** 잡은 자리와 블록 위 가장자리 사이 — 잔상이 잡은 자리 그대로 따라오게 */
  grabOffset: number;
}

export interface BlockDragOptions {
  editor: Editor;
  frameRef: RefObject<HTMLDivElement | null>;
  /** 손잡이가 붙은 최상위 블록 번호 */
  from: number;
  onDraggingChange: (dragging: boolean) => void;
  onDrop: (from: number, gap: number) => void;
}

type PointerHandler = (event: PointerEvent<HTMLElement>) => void;

export interface BlockDragHandle {
  drag: BlockDrag | null;
  handlers: {
    onPointerDown: PointerHandler;
    onPointerMove: PointerHandler;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
  /** 방금 끌기로 끝났나 — 끌고 난 뒤 같은 버튼에서 떼면 click도 오는데, 그 click은 누르기가 아니다. 읽으면 지운다 */
  takeDragged: () => boolean;
}

/** 잔상용 복제 — 포커스 · 편집 · 접근성 트리에 끼지 않게 편집 속성과 id를 걷어 낸다 */
function ghostOf(block: HTMLElement): HTMLElement {
  const clone = block.cloneNode(true) as HTMLElement;
  for (const element of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
    element.removeAttribute("contenteditable");
    element.removeAttribute("id");
    element.removeAttribute("tabindex");
  }
  return clone;
}

/**
 * 블록 손잡이 끌기(block-controls design.md 2~4). 4px 문턱을 넘으면 끌기, 끄는 동안 잔상 · 놓일 자리 선 ·
 * 가장자리 자동 스크롤, 놓을 때 onDrop 한 번. HTML5 DnD가 아니라 포인터 캡처로 끈다 — ProseMirror 기본 drop은
 * Slice를 직렬화해 붙여넣기 정규화를 거치므로 꾸미기가 걸러질 수 있다
 * (openspec block-drag-handle design.md 1 · https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture).
 */
export function useBlockDrag({
  editor,
  frameRef,
  from,
  onDraggingChange,
  onDrop,
}: BlockDragOptions): BlockDragHandle {
  const [drag, setDrag] = useState<BlockDrag | null>(null);
  const press = useRef<Press | null>(null);
  const pointerY = useRef(0);
  const dragged = useRef(false);

  const cancel = useCallback(() => {
    press.current = null;
    setDrag(null);
    onDraggingChange(false);
  }, [onDraggingChange]);
  useEscapeKey(drag !== null, cancel);

  const viewAt = useCallback(
    (clientY: number, frameEl: HTMLElement, grabOffset: number): DragView => {
      const { bands, frame } = measureBlocks(editor, frameEl);
      const gap = dropGapAt(bands, clientY);
      return {
        gap,
        lineTop: dropLineTop(bands, gap, frame.top),
        ghostTop: clientY - frame.top - grabOffset,
      };
    },
    [editor],
  );

  const onScrolled = useCallback(() => {
    setDrag((current) =>
      current === null
        ? null
        : { ...current, ...viewAt(pointerY.current, current.frameEl, current.grabOffset) },
    );
  }, [viewAt]);
  useAutoScroll(drag?.frameEl ?? null, pointerY, onScrolled);

  const startDrag = (clientY: number) => {
    const frameEl = frameRef.current;
    // https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM
    const block = editor.view.nodeDOM(blockStart(editor.state.doc, from));
    if (frameEl === null || !(block instanceof HTMLElement)) return;
    const frame = frameEl.getBoundingClientRect();
    const rect = block.getBoundingClientRect();
    const grabOffset = clientY - rect.top;
    dragged.current = true;
    setDrag({
      from,
      doc: editor.state.doc,
      frameEl,
      ghost: ghostOf(block),
      ghostLeft: rect.left - frame.left,
      ghostWidth: rect.width,
      grabOffset,
      ...viewAt(clientY, frameEl, grabOffset),
    });
    onDraggingChange(true);
  };

  const onPointerDown: PointerHandler = (event) => {
    // 주 버튼만. 한글 조합 중에는 문서를 바꾸는 일을 시작하지 않는다(.claude/rules/editor.md)
    if (event.button !== 0 || editor.view.composing) return;
    // 편집 영역의 포커스 · 선택이 버튼으로 튀지 않게
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragged.current = false;
    press.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove: PointerHandler = (event) => {
    pointerY.current = event.clientY;
    if (drag !== null) {
      setDrag({ ...drag, ...viewAt(event.clientY, drag.frameEl, drag.grabOffset) });
      return;
    }
    const start = press.current;
    if (start === null) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > DRAG_THRESHOLD_PX) {
      press.current = null;
      startDrag(event.clientY);
    }
  };

  const onPointerUp = () => {
    press.current = null;
    if (drag === null) return;
    cancel();
    const unchanged = editor.state.doc === drag.doc && !editor.view.composing;
    if (unchanged) onDrop(drag.from, drag.gap);
  };

  const takeDragged = () => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  };

  return {
    drag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancel,
      onLostPointerCapture: () => {
        if (drag !== null) cancel();
      },
    },
    takeDragged,
  };
}
