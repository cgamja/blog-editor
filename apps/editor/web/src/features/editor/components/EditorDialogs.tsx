import type { Doc, PostMeta } from "@blog-editor/content-schema";
import { useWarmDisplayFont } from "../../../shared/ui/use-warm-display-font";
import { EDITOR_MESSAGES } from "../messages";
import { missingForSave } from "../post-meta";
import { seoCheckOf } from "../seo-check";
import type { EditorOverlay, SeoOthers } from "../types";
import { AiUndoDialog } from "./AiUndoDialog";
import { ConflictDialog } from "./ConflictDialog";
import { PreviewDialog } from "./PreviewDialog";
import { PublishDialog } from "./PublishDialog";

/** 제목 글꼴로 그리는 대화상자 제목. 미리보기 iframe 안 본문 제목은 이 훅 대상이 아니다(글꼴 원천이 따로 — 후속 이슈) */
const DIALOG_TITLES = [
  EDITOR_MESSAGES.conflict.title,
  EDITOR_MESSAGES.publish.title,
  EDITOR_MESSAGES.publish.updateTitle,
  EDITOR_MESSAGES.preview.title,
  EDITOR_MESSAGES.aiUndo.title,
];

export interface EditorDialogActions {
  onClose: () => void;
  onCopyAndOpenLatest: () => void;
  onKeepWriting: () => void;
  onOverwrite: () => void;
  onConfirmPublish: () => void;
  onConfirmAiUndo: () => void;
  /** AI 수정 되돌리기 확인을 닫는다 — 지난 실패 문장도 지운다 */
  onCancelAiUndo: () => void;
}

export interface EditorDialogsProps {
  overlay: EditorOverlay;
  form: { meta: PostMeta; slug: string };
  isPublished: boolean;
  /** 미리보기를 연 순간의 문서 */
  previewDoc: Doc | null;
  /** 발행 확인을 연 순간의 문서 — 검색 노출 점검이 읽는다(닫힌 집합을 어기면 null) */
  publishDoc: Doc | null;
  /** 제목 · 설명 중복 점검에 쓰는 다른 글과 조회 상태 */
  others: SeoOthers;
  /** AI 수정 되돌리기 요청 상태 */
  aiUndo: { isReverting: boolean; isFailed: boolean };
  actions: EditorDialogActions;
}

/** 편집 화면 위에 뜨는 것 하나 — 충돌(67:2) · 발행 확인 · 미리보기 · AI 수정 되돌리기 확인 */
export function EditorDialogs({
  overlay,
  form,
  isPublished,
  previewDoc,
  publishDoc,
  others,
  aiUndo,
  actions,
}: EditorDialogsProps) {
  useWarmDisplayFont(DIALOG_TITLES);
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
        seo={seoCheckOf({ ...form, doc: publishDoc, others })}
        onConfirm={actions.onConfirmPublish}
        onCancel={actions.onClose}
      />
    );
  }
  if (overlay === "aiUndo") {
    return (
      <AiUndoDialog
        isReverting={aiUndo.isReverting}
        isFailed={aiUndo.isFailed}
        onConfirm={actions.onConfirmAiUndo}
        onCancel={actions.onCancelAiUndo}
      />
    );
  }
  if (overlay === "preview" && previewDoc !== null) {
    return <PreviewDialog title={form.meta.title} doc={previewDoc} onClose={actions.onClose} />;
  }
  return null;
}
