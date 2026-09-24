import { useCallback, useState } from "react";
import type { PointerEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import type { Node } from "@tiptap/pm/model";
import { dropGapAt } from "@blog-editor/editor-core";
import { dropLineTop, measureBlocks } from "./block-geometry";
import { BLOCK_HANDLE_MESSAGES } from "./messages";
import { useEscapeKey } from "./use-dismiss";

interface Drag {
  from: number;
  gap: number;
  lineTop: number;
  /** 끌기를 시작할 때의 문서 — 끄는 사이 문서가 바뀌면 번호가 틀리므로 놓지 않는다 */
  doc: Node;
  /** 선을 그릴 틀 — 렌더 중에 ref를 읽지 않도록 시작할 때 잡아 둔다 */
  frameEl: HTMLElement;
}

export interface BlockMoveHandleProps {
  editor: Editor;
  frameRef: RefObject<HTMLDivElement | null>;
  /** 손잡이가 붙은 최상위 블록 번호 */
  from: number;
  onDraggingChange: (dragging: boolean) => void;
  onDrop: (from: number, gap: number) => void;
}

/**
 * 「블록 옮기기」 손잡이. HTML5 DnD가 아니라 포인터 캡처로 끈다 — ProseMirror 기본 drop은 Slice를 직렬화해
 * 붙여넣기 정규화를 거치므로 꾸미기가 걸러질 수 있고, 놓는 자리도 블록 사이로 제한되지 않는다
 * (openspec block-drag-handle design.md 1 · https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture).
 * Tab 순서에서는 뺀다 — 마우스를 올린 블록에만 뜨는 버튼이다. 키보드는 Mod-Shift-↑/↓(design.md 4).
 */
export function BlockMoveHandle({
  editor,
  frameRef,
  from,
  onDraggingChange,
  onDrop,
}: BlockMoveHandleProps) {
  const [drag, setDrag] = useState<Drag | null>(null);

  const cancel = useCallback(() => {
    setDrag(null);
    onDraggingChange(false);
  }, [onDraggingChange]);
  useEscapeKey(drag !== null, cancel);

  const at = (clientY: number, frameEl: HTMLElement) => {
    const { bands, frame } = measureBlocks(editor, frameEl);
    const gap = dropGapAt(bands, clientY);
    return { gap, lineTop: dropLineTop(bands, gap, frame.top) };
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const frameEl = frameRef.current;
    // 주 버튼만. 한글 조합 중에는 문서를 바꾸는 일을 시작하지 않는다(.claude/rules/editor.md)
    if (event.button !== 0 || frameEl === null || editor.view.composing) return;
    // 편집 영역의 포커스 · 선택이 버튼으로 튀지 않게
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from, doc: editor.state.doc, frameEl, ...at(event.clientY, frameEl) });
    onDraggingChange(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag === null) return;
    setDrag({ ...drag, ...at(event.clientY, drag.frameEl) });
  };

  const onPointerUp = () => {
    if (drag === null) return;
    cancel();
    const unchanged = editor.state.doc === drag.doc && !editor.view.composing;
    if (unchanged) onDrop(drag.from, drag.gap);
  };

  return (
    <>
      <button
        type="button"
        className="block-handle-move"
        aria-label={BLOCK_HANDLE_MESSAGES.move}
        title={BLOCK_HANDLE_MESSAGES.moveHint}
        tabIndex={-1}
        data-dragging={drag !== null || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancel}
        onLostPointerCapture={() => drag !== null && cancel()}
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
      {/* 선은 틀 기준 좌표라 틀에 바로 그린다 — 손잡이 줄은 블록 옆으로 옮겨진 좌표계다 */}
      {drag !== null &&
        createPortal(
          <div className="block-drop-line" style={{ top: drag.lineTop }} aria-hidden="true" />,
          drag.frameEl,
        )}
    </>
  );
}
