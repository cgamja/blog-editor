import { useId, useSyncExternalStore } from "react";
import { decorationMessages } from "./decoration-messages";

export interface MotionPreviewButtonProps {
  hasMotion: boolean;
  previewing: boolean;
  onPreview: () => void;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** https://react.dev/reference/react/useSyncExternalStore#subscribing-to-a-browser-api */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
  );
}

/** 「움직임 미리 보기」 — 움직임을 줄인 사용자에게는 막고 안내만 보인다(spec: decoration-panel design.md 3) */
export function MotionPreviewButton({
  hasMotion,
  previewing,
  onPreview,
}: MotionPreviewButtonProps) {
  const reasonId = useId();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <>
      <button
        type="button"
        className="decoration-panel-preview"
        disabled={reducedMotion || !hasMotion || previewing}
        aria-describedby={reducedMotion ? reasonId : undefined}
        onClick={onPreview}
      >
        {decorationMessages.previewButton}
      </button>
      {reducedMotion && (
        <p id={reasonId} className="decoration-panel-hint">
          {decorationMessages.previewReducedMotion}
        </p>
      )}
    </>
  );
}
