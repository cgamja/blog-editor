import { useId } from "react";
import { STICKER_OPTIONS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { reasonOf } from "./decoration-state";
import type { Availability, StickerId } from "./decoration-types";

export interface StickerFieldProps {
  count: number;
  availability: Availability;
  /** 스티커 그림 주소. 없으면 스티커 이름을 글자로 보인다 */
  stickerSrc?: ((id: StickerId) => string) | undefined;
  onAdd: (id: StickerId) => void;
}

/** 스티커 9칸(디자인 69:2). 누르면 고른 블록 기본 자리에 붙는다 — 끌어다 놓기는 #61 */
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
            onClick={() => onAdd(id)}
          >
            {stickerSrc === undefined ? label : <img src={stickerSrc(id)} alt="" />}
          </button>
        ))}
      </div>
      <p id={hintId} className="decoration-panel-hint">
        {reason ?? decorationMessages.stickerHint(count)}
      </p>
    </fieldset>
  );
}
