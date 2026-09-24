import { useCallback, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import type { Node } from "@tiptap/pm/model";
import { blockStart, dropGapAt } from "@blog-editor/editor-core";
import { dropLineTop, measureBlocks } from "./block-geometry";
import { BLOCK_HANDLE_MESSAGES } from "./messages";
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

interface Drag extends DragView {
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

export interface BlockMoveHandleProps {
  editor: Editor;
  frameRef: RefObject<HTMLDivElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** 손잡이가 붙은 최상위 블록 번호 */
  from: number;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onDraggingChange: (dragging: boolean) => void;
  onDrop: (from: number, gap: number) => void;
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
 * 「블록 옮기기」 손잡이 겸 블록 메뉴 버튼(Notion의 ⋮⋮). 4px 넘게 끌면 옮기기, 그 전에 떼면 메뉴를 연다.
 * HTML5 DnD가 아니라 포인터 캡처로 끈다 — ProseMirror 기본 drop은 Slice를 직렬화해 붙여넣기 정규화를
 * 거치므로 꾸미기가 걸러질 수 있고, 놓는 자리도 블록 사이로 제한되지 않는다
 * (openspec block-drag-handle design.md 1 · https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture).
 * Tab 순서에서는 뺀다 — 마우스를 올린 블록에만 뜨는 버튼이다. 키보드는 Mod-Shift-↑/↓(design.md 4).
 */
export function BlockMoveHandle({
  editor,
  frameRef,
  buttonRef,
  from,
  menuOpen,
  onMenuToggle,
  onDraggingChange,
  onDrop,
}: BlockMoveHandleProps) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const press = useRef<Press | null>(null);
  const pointerY = useRef(0);
  // 끌고 난 뒤 같은 버튼에서 떼면 click도 온다 — 그 click은 메뉴를 열지 않는다
  const draggedRef = useRef(false);

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
    draggedRef.current = true;
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

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    // 주 버튼만. 한글 조합 중에는 문서를 바꾸는 일을 시작하지 않는다(.claude/rules/editor.md)
    if (event.button !== 0 || editor.view.composing) return;
    // 편집 영역의 포커스 · 선택이 버튼으로 튀지 않게
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggedRef.current = false;
    press.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
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

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onMenuToggle();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="block-handle-move"
        aria-label={BLOCK_HANDLE_MESSAGES.move}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={BLOCK_HANDLE_MESSAGES.moveHint}
        tabIndex={-1}
        data-dragging={drag !== null || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancel}
        onLostPointerCapture={() => drag !== null && cancel()}
        onClick={onClick}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      {/* 선 · 잔상은 틀 기준 좌표라 틀에 바로 그린다 — 손잡이 줄은 블록 옆으로 옮겨진 좌표계다 */}
      {drag !== null &&
        createPortal(
          <>
            <div className="block-drop-line" style={{ top: drag.lineTop }} aria-hidden="true" />
            <div
              className="block-drag-ghost"
              style={{ top: drag.ghostTop, left: drag.ghostLeft, width: drag.ghostWidth }}
              aria-hidden="true"
              ref={(element) => {
                if (element !== null && element.firstChild !== drag.ghost) {
                  element.replaceChildren(drag.ghost);
                }
              }}
            />
          </>,
          drag.frameEl,
        )}
    </>
  );
}
