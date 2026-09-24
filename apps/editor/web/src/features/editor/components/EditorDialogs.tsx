import type { Doc, PostMeta } from "@blog-editor/content-schema";
import { missingForSave } from "../post-meta";
import type { EditorOverlay } from "../types";
import { ConflictDialog } from "./ConflictDialog";
import { PreviewDialog } from "./PreviewDialog";
import { PublishDialog } from "./PublishDialog";

export interface EditorDialogActions {
  onClose: () => void;
  onCopyAndOpenLatest: () => void;
  onKeepWriting: () => void;
  onOverwrite: () => void;
  onConfirmPublish: () => void;
}

export interface EditorDialogsProps {
  overlay: EditorOverlay;
  form: { meta: PostMeta; slug: string };
  isPublished: boolean;
  /** 미리보기를 연 순간의 문서 */
  previewDoc: Doc | null;
  actions: EditorDialogActions;
}

/** 편집 화면 위에 뜨는 것 하나 — 충돌(67:2) · 발행 확인 · 미리보기 */
export function EditorDialogs({
  overlay,
  form,
  isPublished,
  previewDoc,
  actions,
}: EditorDialogsProps) {
  if (overlay === "conflict") {
    return (
      <ConflictDialog
        onCopyAndOpenLatest={actions.onCopyAndOpenLatest}
        onKeepWriting={actions.onKeepWriting}
        onOverwrite={actions.onOverwrite}
      />
    );
  }
  if (overlay === "publish") {
    return (
      <PublishDialog
        isUpdate={isPublished}
        missing={missingForSave(form.meta, form.slug)}
        onConfirm={actions.onConfirmPublish}
        onCancel={actions.onClose}
      />
    );
  }
  if (overlay === "preview" && previewDoc !== null) {
    return <PreviewDialog title={form.meta.title} doc={previewDoc} onClose={actions.onClose} />;
  }
  return null;
}
