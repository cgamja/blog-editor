import { useId } from "react";
import { STICKER_OPTIONS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { reasonOf } from "./decoration-state";
import type { Availability, StickerId } from "./decoration-types";
import { writeStickerDrag } from "./sticker-ui";

export interface StickerFieldProps {
  count: number;
  availability: Availability;
  /** 스티커 그림 주소. 없으면 스티커 이름을 글자로 보인다 */
  stickerSrc?: ((id: StickerId) => string) | undefined;
  onAdd: (id: StickerId) => void;
}

/**
 * 스티커 9칸(디자인 69:2). 누르면 고른 블록 기본 자리에 붙고, 글 위로 끌어다 놓으면 놓은 자리에서 가장 가까운
 * 블록에 붙는다 — 받는 쪽은 StickerLayer의 handleDrop(sticker-drag design.md 5). 끌기는 포인터 전용이고
 * 키보드는 누르기(onClick)로 같은 일을 한다.
 * https://developer.mozilla.org/docs/Web/API/HTML_Drag_and_Drop_API
 */
export function StickerField({ count, availability, stickerSrc, onAdd }: StickerFieldProps) {
  const hintId = useId();
  const reason = reasonOf(availability);

  return (
    <fieldset>
      <legend>{decorationMessages.stickerLegend}</legend>
      <div className="decoration-panel-grid">
        {STICKER_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="decoration-panel-choice decoration-panel-sticker"
            aria-label={decorationMessages.stickerButton(label)}
            disabled={reason !== null}
            aria-describedby={reason === null ? undefined : hintId}
            draggable={reason === null}
            onDragStart={(event) => {
              writeStickerDrag(event.dataTransfer, id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onAdd(id)}
          >
            {stickerSrc === undefined ? (
              label
            ) : (
              <img src={stickerSrc(id)} alt="" draggable={false} />
            )}
          </button>
        ))}
      </div>
      <p id={hintId} className="decoration-panel-hint">
        {reason ?? decorationMessages.stickerHint(count)}
      </p>
    </fieldset>
  );
}
