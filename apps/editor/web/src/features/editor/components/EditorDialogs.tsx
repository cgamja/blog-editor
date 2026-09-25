import { checkSeo } from "@blog-editor/content-schema";
import type { Doc, PostMeta, SeoOtherPost } from "@blog-editor/content-schema";
import { useWarmDisplayFont } from "../../../shared/ui/use-warm-display-font";
import { EDITOR_MESSAGES } from "../messages";
import { missingForSave } from "../post-meta";
import type { EditorOverlay } from "../types";
import { ConflictDialog } from "./ConflictDialog";
import { PreviewDialog } from "./PreviewDialog";
import { PublishDialog } from "./PublishDialog";

/** 제목 글꼴로 그리는 대화상자 제목. 미리보기 iframe 안 본문 제목은 이 훅 대상이 아니다(글꼴 원천이 따로 — 후속 이슈) */
const DIALOG_TITLES = [
  EDITOR_MESSAGES.conflict.title,
  EDITOR_MESSAGES.publish.title,
  EDITOR_MESSAGES.publish.updateTitle,
  EDITOR_MESSAGES.preview.title,
];

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
  /** 발행 확인을 연 순간의 문서 — 검색 노출 점검이 읽는다(닫힌 집합을 어기면 null) */
  publishDoc: Doc | null;
  /** 제목 중복 점검에 쓰는 다른 글 */
  otherPosts: readonly SeoOtherPost[];
  actions: EditorDialogActions;
}

/** 편집 화면 위에 뜨는 것 하나 — 충돌(67:2) · 발행 확인 · 미리보기 */
export function EditorDialogs({
  overlay,
  form,
  isPublished,
  previewDoc,
  publishDoc,
  otherPosts,
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
        seo={
          publishDoc === null
            ? null
            : checkSeo({ slug: form.slug, meta: form.meta, doc: publishDoc, others: otherPosts })
        }
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
