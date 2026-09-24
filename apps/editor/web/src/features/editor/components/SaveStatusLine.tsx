import { EDITOR_MESSAGES } from "../messages";
import { saveStatusText } from "../save-model";
import type { SaveStatus } from "../types";

/** 머리줄 저장 문구(디자인 결정 4-A) — 실패면 「다시 시도」가 붙는다. 자리는 틀의 `role="status"` 안이다 */
export function SaveStatusLine({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const isFailed = status.kind === "failed";
  return (
    <span className={`editor-save-status editor-save-status-${status.kind}`}>
      {saveStatusText(status)}
      {isFailed && (
        <button type="button" className="editor-save-retry" onClick={onRetry}>
          {EDITOR_MESSAGES.status.retry}
        </button>
      )}
    </span>
  );
}
