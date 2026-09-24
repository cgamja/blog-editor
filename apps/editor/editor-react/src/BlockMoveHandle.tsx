import type { MouseEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { BlockDragOverlay } from "./BlockDragOverlay";
import { BLOCK_HANDLE_MESSAGES } from "./messages";
import { useBlockDrag } from "./use-block-drag";

export interface BlockMoveHandleProps {
  editor: Editor;
  frameRef: RefObject<HTMLDivElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** 손잡이가 붙은 최상위 블록 번호 */
  from: number;
  /** 누르기 — 블록 메뉴 */
  menu: { open: boolean; onToggle: () => void };
  /** 끌기 — 시작 · 끝 알림과 놓기 */
  dragEvents: {
    onDraggingChange: (dragging: boolean) => void;
    onDrop: (from: number, gap: number) => void;
  };
}

/**
 * 「블록 옮기기」 손잡이 겸 블록 메뉴 버튼(Notion의 ⋮⋮). 끌기는 useBlockDrag가 맡고, 여기는 끌지 않고 누르면
 * 메뉴를 여닫는 일만 한다. Tab 순서에서는 뺀다 — 마우스를 올린 블록에만 뜨는 버튼이다.
 * 키보드는 Mod-Shift-↑/↓(block-drag-handle design.md 4).
 */
export function BlockMoveHandle({
  editor,
  frameRef,
  buttonRef,
  from,
  menu,
  dragEvents,
}: BlockMoveHandleProps) {
  const { drag, handlers, takeDragged } = useBlockDrag({ editor, frameRef, from, ...dragEvents });

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!takeDragged()) menu.onToggle();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="block-handle-move"
        aria-label={BLOCK_HANDLE_MESSAGES.move}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        title={BLOCK_HANDLE_MESSAGES.moveHint}
        tabIndex={-1}
        data-dragging={drag !== null || undefined}
        {...handlers}
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
      {drag !== null && <BlockDragOverlay drag={drag} />}
    </>
  );
}
