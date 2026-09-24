import { useId } from "react";
import { MOTION_OPTIONS } from "./decoration-constants";
import { decorationMessages } from "./decoration-messages";
import { reasonOf } from "./decoration-state";
import type { Availability, Motion } from "./decoration-types";

export interface MotionFieldProps {
  value: Motion | null;
  availability: Availability;
  /** 빈 값(없음)은 null — 값 검증은 editor-core 커맨드가 한다 */
  onChange: (motion: string | null) => void;
}

/** 움직임 select(디자인 69:2) */
export function MotionField({ value, availability, onChange }: MotionFieldProps) {
  const selectId = useId();
  const hintId = useId();
  const reason = reasonOf(availability);

  return (
    <div className="decoration-panel-field">
      <label htmlFor={selectId}>{decorationMessages.motionLabel}</label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={reason !== null}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value || null)}
      >
        {MOTION_OPTIONS.map((option) => (
          <option key={option.label} value={option.value ?? ""}>
            {option.label}
          </option>
        ))}
      </select>
      <p id={hintId} className="decoration-panel-hint">
        {reason ?? decorationMessages.motionHint}
      </p>
    </div>
  );
}
