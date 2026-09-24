import { useId } from "react";
import { FONT_OPTIONS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { reasonOf } from "./decoration-state";
import type { Availability, Font } from "./decoration-types";

export interface FontFieldProps {
  value: Font | null;
  availability: Availability;
  /** null이면 지운다(본문 기본 글씨체) */
  onChange: (font: Font | null) => void;
}

/** 글씨체 3칸(디자인 69:2). 눌린 칸을 다시 누르면 지운다 */
export function FontField({ value, availability, onChange }: FontFieldProps) {
  const reasonId = useId();
  const reason = reasonOf(availability);

  return (
    <fieldset>
      <legend>{decorationMessages.fontLegend}</legend>
      <div className="decoration-panel-grid">
        {FONT_OPTIONS.map((option) => {
          const pressed = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className="decoration-panel-choice"
              aria-pressed={pressed}
              disabled={reason !== null}
              aria-describedby={reason === null ? undefined : reasonId}
              onClick={() => onChange(pressed ? null : option.value)}
            >
              <span className="decoration-panel-sample" data-font={option.value}>
                {decorationMessages.fontSample}
              </span>
              <span className="decoration-panel-caption">{option.label}</span>
            </button>
          );
        })}
      </div>
      {reason !== null && (
        <p id={reasonId} className="decoration-panel-hint">
          {reason}
        </p>
      )}
    </fieldset>
  );
}
