import { useId } from "react";
import { AlignIcon } from "./AlignIcon";
import { ALIGN_OPTIONS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { reasonOf } from "./decoration-state";
import type { Align, Availability } from "./decoration-types";

export interface AlignFieldProps {
  value: Align | null;
  availability: Availability;
  onChange: (align: Align) => void;
}

/** 정렬 3버튼(spec: decoration-panel). 눌림은 지금 모양 — 저장값이 없으면 그 블록의 기본 모양이 눌려 있다 */
export function AlignField({ value, availability, onChange }: AlignFieldProps) {
  const reasonId = useId();
  const reason = reasonOf(availability);

  return (
    <fieldset>
      <legend>{decorationMessages.alignLegend}</legend>
      <div className="decoration-panel-grid">
        {ALIGN_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="decoration-panel-choice decoration-panel-align"
            aria-label={decorationMessages.alignButton(option.label)}
            aria-pressed={value === option.value}
            disabled={reason !== null}
            aria-describedby={reason === null ? undefined : reasonId}
            onClick={() => onChange(option.value)}
          >
            <AlignIcon align={option.value} />
          </button>
        ))}
      </div>
      {reason !== null && (
        <p id={reasonId} className="decoration-panel-hint">
          {reason}
        </p>
      )}
    </fieldset>
  );
}
