import { EDITOR_MESSAGES } from "../messages";
import type { MetaField } from "../types";
import { ModalDialog } from "./ModalDialog";

export interface PublishDialogProps {
  /** 이미 발행한 글을 고쳐 다시 공개하는가 */
  isUpdate: boolean;
  /** 비어서 발행할 수 없는 칸 — 있으면 확인 버튼이 없다 */
  missing: readonly MetaField[];
  onConfirm: () => void;
  onCancel: () => void;
}

/** 발행 확인(디자인 결정 "발행": 확인 대화상자 한 번 — "발행하면 주소는 바꿀 수 없어요") */
export function PublishDialog({ isUpdate, missing, onConfirm, onCancel }: PublishDialogProps) {
  const { publish, fieldNames } = EDITOR_MESSAGES;
  const isBlocked = missing.length > 0;
  return (
    <ModalDialog title={isUpdate ? publish.updateTitle : publish.title} onClose={onCancel}>
      {isBlocked ? (
        <p className="editor-dialog-body">
          {publish.incomplete} {missing.map((field) => fieldNames[field]).join(" · ")}
        </p>
      ) : (
        <p className="editor-dialog-body">{isUpdate ? publish.updateBody : publish.body}</p>
      )}
      <div className="editor-dialog-row">
        <button type="button" className="editor-dialog-secondary" onClick={onCancel}>
          {publish.cancel}
        </button>
        {!isBlocked && (
          <button type="button" className="editor-dialog-primary" onClick={onConfirm}>
            {isUpdate ? publish.confirmUpdate : publish.confirm}
          </button>
        )}
      </div>
    </ModalDialog>
  );
}
