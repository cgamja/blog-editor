import { EDITOR_MESSAGES } from "../messages";
import { ModalDialog } from "./ModalDialog";

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
  return (
    <ModalDialog title={conflict.title} onClose={onKeepWriting} className="editor-dialog-conflict">
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
