import { useId } from "react";
import { EDITOR_MESSAGES } from "../messages";
import { ModalDialog } from "../../../shared/ui/ModalDialog";

export interface AiUndoDialogProps {
  /** 되돌리기 요청 중 — 확인 버튼을 한 번만 누르게 한다 */
  isReverting: boolean;
  /** 되돌리지 못했다(409 밖) — 확인 버튼 대신 까닭을 보인다 */
  isFailed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** AI 수정 되돌리기 확인(ADR-041) — 발행 확인과 같은 틀: 취소 · 되돌리기 */
export function AiUndoDialog({ isReverting, isFailed, onConfirm, onCancel }: AiUndoDialogProps) {
  const { aiUndo } = EDITOR_MESSAGES;
  const titleId = useId();
  return (
    <ModalDialog open onClose={onCancel} labelledBy={titleId} className="editor-dialog">
      <h2 id={titleId} className="editor-dialog-title">
        {aiUndo.title}
      </h2>
      <p className="editor-dialog-body" role={isFailed ? "alert" : undefined}>
        {isFailed ? aiUndo.failed : aiUndo.body}
      </p>
      <div className="editor-dialog-row">
        <button type="button" className="editor-dialog-secondary" onClick={onCancel}>
          {aiUndo.cancel}
        </button>
        {!isFailed && (
          <button
            type="button"
            className="editor-dialog-primary"
            aria-disabled={isReverting ? true : undefined}
            onClick={isReverting ? undefined : onConfirm}
          >
            {aiUndo.confirm}
          </button>
        )}
      </div>
    </ModalDialog>
  );
}
