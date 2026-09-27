import { useId } from "react";
import { SPACE_OPTIONS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { reasonOf } from "./decoration-state";
import type { Availability, Space } from "./decoration-types";

export interface SpaceFieldProps {
  /** null이면 보통(저장값 없음) */
  value: Space | null;
  availability: Availability;
  /** null이면 지운다(보통) */
  onChange: (space: Space | null) => void;
}

/** 간격 4버튼(adr-037) — 보통 · 좁게 · 넓게 · 아주 넓게. 눌림은 지금 값이고, 값이 없으면 보통이 눌려 있다 */
export function SpaceField({ value, availability, onChange }: SpaceFieldProps) {
  const reasonId = useId();
  const hintId = useId();
  const reason = reasonOf(availability);

  return (
    <fieldset>
      <legend>{decorationMessages.spaceLegend}</legend>
      <div className="decoration-panel-grid decoration-panel-grid-2">
        {SPACE_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className="decoration-panel-choice decoration-panel-compact"
            aria-label={decorationMessages.spaceButton(option.label)}
            aria-pressed={value === option.value}
            disabled={reason !== null}
            aria-describedby={reason === null ? hintId : reasonId}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {reason === null ? (
        <p id={hintId} className="decoration-panel-hint">
          {decorationMessages.spaceHint}
        </p>
      ) : (
        <p id={reasonId} className="decoration-panel-hint">
          {reason}
        </p>
      )}
    </fieldset>
  );
}
