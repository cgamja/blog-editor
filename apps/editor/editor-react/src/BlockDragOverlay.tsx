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
      {/* post-body: 본문 CSS를 받는다. inert: 복제된 링크 · 버튼이 Tab 포커스를 받지 않는다
          (https://developer.mozilla.org/docs/Web/HTML/Global_attributes/inert) */}
      <div
        className="block-drag-ghost post-body"
        style={{ top: drag.ghostTop, left: drag.ghostLeft, width: drag.ghostWidth }}
        aria-hidden="true"
        inert
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
