import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { Doc } from "@blog-editor/content-schema";
import {
  EditorScreen,
  editorPlainText,
  focusEditorStart,
  useBlogEditor,
  type SideTab,
  type StickerId,
} from "@blog-editor/editor-react";
import { ROUTES } from "../../../shared/routes/constants";
import { loginPathFor } from "../../../shared/routes/next-path";
import { fetchPostCategories, fetchPost } from "../api";
import { POST_LIST_QUERY_KEY } from "../constants";
import { clearLocalDraft, writeLocalCopy } from "../local-draft";
import { EDITOR_MESSAGES } from "../messages";
import { missingForSave } from "../post-meta";
import { useImageUploader } from "../hooks/use-image-uploader";
import { usePostSave } from "../hooks/use-post-save";
import { useSaveShortcut } from "../hooks/use-save-shortcut";
import type { EditingStart, EditorOverlay } from "../types";
import { ConflictDialog } from "./ConflictDialog";
import { ExpiredBanner } from "./ExpiredBanner";
import { PostInfoPanel } from "./PostInfoPanel";
import { PreviewDialog } from "./PreviewDialog";
import { PublishDialog } from "./PublishDialog";
import { SaveStatusLine } from "./SaveStatusLine";
import { TitleField } from "./TitleField";

/** 스티커 원본 — 개발 서버는 content-render assets를 `/stickers/`로 서빙한다(vite publicDir, 배포는 M4) */
const stickerSrc = (id: StickerId) => `/stickers/${id}.png`;

export interface PostEditorProps {
  start: EditingStart;
  onAdopt: (slug: string) => void;
  /** 「내 글을 복사해 두고 최신 글 열기」 — 최신 글로 에디터를 새로 만든다 */
  onReload: (slug: string) => void;
}

/** 편집 화면 한 벌(디자인 68:2) — 틀은 editor-react `EditorScreen`, 저장 흐름은 `usePostSave` */
export function PostEditor({ start, onAdopt, onReload }: PostEditorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { editor, getDoc } = useBlogEditor({
    doc: start.doc,
    key: "post",
    label: EDITOR_MESSAGES.bodyLabel,
  });
  const [overlay, setOverlay] = useState<EditorOverlay>(
    start.restore === "conflict" ? "conflict" : null,
  );
  const [tab, setTab] = useState<SideTab>("postInfo");
  // 미리보기는 연 순간의 문서를 그린다 — 렌더마다 읽으면 요청이 되풀이된다
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const uploadImage = useImageUploader();
  const categories = useQuery({ queryKey: POST_LIST_QUERY_KEY, queryFn: fetchPostCategories });
  const post = usePostSave({
    editor,
    getDoc,
    start,
    onAdopt,
    onConflict: () => setOverlay("conflict"),
  });

  const handleSaveDraft = () => {
    if (post.isPublished) setOverlay("publish");
    else void post.saveNow();
  };
  useSaveShortcut(handleSaveDraft);

  const handleBack = async () => {
    if (!post.isPublished) await post.saveNow().catch(() => undefined);
    void navigate(ROUTES.home);
  };

  const handleRelogin = () => {
    void navigate(loginPathFor(`${location.pathname}${location.search}`));
  };

  const handleCopyAndOpenLatest = () => {
    const savedSlug = post.savedSlug();
    // 클립보드는 거부될 수 있다(권한 · 창 포커스) — 사본은 브라우저 저장소에도 남긴다
    navigator.clipboard?.writeText(editorPlainText(editor)).catch(() => undefined);
    writeLocalCopy(post.localKey(), post.currentDraft());
    clearLocalDraft(post.localKey());
    setOverlay(null);
    if (savedSlug !== null) onReload(savedSlug);
  };

  const handleOverwrite = async () => {
    const savedSlug = post.savedSlug();
    setOverlay(null);
    if (savedSlug === null) return;
    const latest = await fetchPost(savedSlug).catch(() => null);
    if (latest === null) {
      post.pause();
      return;
    }
    await post.overwriteWith(latest.revision);
  };

  const handleOpenPreview = () => {
    try {
      setPreviewDoc(getDoc());
      setOverlay("preview");
    } catch {
      // 닫힌 집합을 어기는 문서 — 저장도 같은 이유로 실패하고 머리줄이 알린다
    }
  };

  const handleConfirmPublish = () => {
    setOverlay(null);
    void post.publish();
  };

  return (
    <>
      <EditorScreen
        editor={editor}
        stickerSrc={stickerSrc}
        uploadImage={uploadImage}
        tab={tab}
        onTabChange={setTab}
        status={<SaveStatusLine status={post.status} onRetry={() => void post.saveNow()} />}
        banner={post.isExpired ? <ExpiredBanner onRelogin={handleRelogin} /> : undefined}
        actions={{
          onBack: () => void handleBack(),
          onPreview: handleOpenPreview,
          onSaveDraft: handleSaveDraft,
          onPublish: () => setOverlay("publish"),
        }}
        title={
          <TitleField
            title={post.meta.title}
            isAiDraft={post.meta.source !== "editor"}
            onTitleChange={(title) => post.changeMeta({ title })}
            onEnter={() => focusEditorStart(editor)}
          />
        }
        postInfo={
          <PostInfoPanel
            meta={post.meta}
            slug={post.slug}
            isPublished={post.isPublished}
            slugError={post.slugError}
            categories={categories.data ?? []}
            onMetaChange={post.changeMeta}
            onSlugChange={post.changeSlug}
            onOpenDecorate={() => setTab("decorate")}
          />
        }
      />
      {overlay === "conflict" && (
        <ConflictDialog
          onCopyAndOpenLatest={handleCopyAndOpenLatest}
          onKeepWriting={() => {
            setOverlay(null);
            post.pause();
          }}
          onOverwrite={() => void handleOverwrite()}
        />
      )}
      {overlay === "publish" && (
        <PublishDialog
          isUpdate={post.isPublished}
          missing={missingForSave(post.meta, post.slug)}
          onConfirm={handleConfirmPublish}
          onCancel={() => setOverlay(null)}
        />
      )}
      {overlay === "preview" && previewDoc !== null && (
        <PreviewDialog title={post.meta.title} doc={previewDoc} onClose={() => setOverlay(null)} />
      )}
    </>
  );
}
