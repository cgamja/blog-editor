import { useId } from "react";
import { EDITOR_MESSAGES } from "../messages";
import { ModalDialog } from "../../../shared/ui/ModalDialog";

export interface ConflictDialogProps {
  onCopyAndOpenLatest: () => void;
  onKeepWriting: () => void;
  onOverwrite: () => void;
}

/** 저장 충돌(409) — 디자인 67:2 그대로: 복사해 두고 최신 열기 · 저장하지 않고 계속 · 덮어쓰기 */
export function ConflictDialog({
  onCopyAndOpenLatest,
  onKeepWriting,
  onOverwrite,
}: ConflictDialogProps) {
  const { conflict } = EDITOR_MESSAGES;
  const titleId = useId();
  return (
    <ModalDialog
      open
      onClose={onKeepWriting}
      labelledBy={titleId}
      className="editor-dialog editor-dialog-conflict"
    >
      <h2 id={titleId} className="editor-dialog-title">
        {conflict.title}
      </h2>
      <p className="editor-dialog-body">{conflict.body}</p>
      <div className="editor-dialog-stack">
        <button type="button" className="editor-dialog-primary" onClick={onCopyAndOpenLatest}>
          {conflict.copyAndOpenLatest}
        </button>
        <button type="button" className="editor-dialog-secondary" onClick={onKeepWriting}>
          {conflict.keepWriting}
        </button>
        <button type="button" className="editor-dialog-danger" onClick={onOverwrite}>
          {conflict.overwrite}
        </button>
      </div>
    </ModalDialog>
  );
}
