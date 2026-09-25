import { useId } from "react";
import type { SeoFinding } from "@blog-editor/content-schema";
import { EDITOR_MESSAGES } from "../messages";
import type { MetaField } from "../types";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { SeoChecklist } from "./SeoChecklist";

export interface PublishDialogProps {
  /** 이미 발행한 글을 고쳐 다시 공개하는가 */
  isUpdate: boolean;
  /** 비어서 발행할 수 없는 칸 — 있으면 확인 버튼이 없다 */
  missing: readonly MetaField[];
  /** 검색 노출 점검(adr-030) — 알리기만 하고 발행 버튼은 남긴다. 문서를 읽지 못했으면 null */
  seo: readonly SeoFinding[] | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 발행 확인(디자인 결정 "발행": 확인 대화상자 한 번 — "발행하면 주소는 바꿀 수 없어요") */
export function PublishDialog({ isUpdate, missing, seo, onConfirm, onCancel }: PublishDialogProps) {
  const { publish, fieldNames } = EDITOR_MESSAGES;
  const isBlocked = missing.length > 0;
  const titleId = useId();
  return (
    <ModalDialog open onClose={onCancel} labelledBy={titleId} className="editor-dialog">
      <h2 id={titleId} className="editor-dialog-title">
        {isUpdate ? publish.updateTitle : publish.title}
      </h2>
      {isBlocked ? (
        <p className="editor-dialog-body">
          {publish.incomplete} {missing.map((field) => fieldNames[field]).join(" · ")}
        </p>
      ) : (
        <>
          <p className="editor-dialog-body">{isUpdate ? publish.updateBody : publish.body}</p>
          <SeoChecklist findings={seo} />
        </>
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
