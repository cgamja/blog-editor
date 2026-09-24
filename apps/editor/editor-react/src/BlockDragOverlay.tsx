import { createPortal } from "react-dom";
import type { BlockDrag } from "./use-block-drag";

/**
 * 끄는 동안의 놓일 자리 선과 블록 잔상(block-controls design.md 3). 틀 기준 좌표라 틀에 바로 그린다 —
 * 손잡이 줄은 블록 옆으로 옮겨진 좌표계다.
 */
export function BlockDragOverlay({ drag }: { drag: BlockDrag }) {
  return createPortal(
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
  );
}
