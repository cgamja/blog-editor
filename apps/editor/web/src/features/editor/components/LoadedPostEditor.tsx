import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { Doc } from "@blog-editor/content-schema";
import {
  EditorScreen,
  focusEditorStart,
  type BlogEditorHandle,
  type SideTab,
  type StickerId,
} from "@blog-editor/editor-react";
import { ROUTES } from "../../../shared/routes/constants";
import { loginPathFor } from "../../../shared/routes/next-path";
import { fetchPostCategories } from "../api";
import { POST_CATEGORIES_QUERY_KEY } from "../constants";
import { useAutosave } from "../hooks/use-autosave";
import { useConflictActions } from "../hooks/use-conflict-actions";
import { useImageUploader } from "../hooks/use-image-uploader";
import { usePublishCheck } from "../hooks/use-publish-check";
import { readDocOrNull } from "../read-doc";
import { usePostForm } from "../hooks/use-post-form";
import { useSaveShortcut } from "../hooks/use-save-shortcut";
import { useServerSave } from "../hooks/use-server-save";
import type { EditableMeta, EditingStart, EditorOverlay } from "../types";
import { EditorDialogs } from "./EditorDialogs";
import { ExpiredBanner } from "./ExpiredBanner";
import { PostInfoPanel } from "./PostInfoPanel";
import { SaveStatusLine } from "./SaveStatusLine";
import { SlugField } from "./SlugField";
import { TitleField } from "./TitleField";

/** 스티커 원본 — 개발 서버는 content-render assets를 `/stickers/`로 서빙한다(vite publicDir, 배포는 M4) */
const stickerSrc = (id: StickerId) => `/stickers/${id}.png`;

export interface LoadedPostEditorProps {
  start: EditingStart;
  /** 이미 생긴 에디터 — PostEditor가 에디터가 생긴 뒤에만 그린다(#108) */
  handle: BlogEditorHandle;
  onAdopt: (slug: string) => void;
  onReload: (slug: string) => void;
}

/**
 * 편집 화면 본체(디자인 68:2) — 틀은 editor-react `EditorScreen`. 입력(`usePostForm`) · 서버 저장
 * (`useServerSave`) · 저장 줄(`useAutosave`)을 여기서 잇는다.
 */
export function LoadedPostEditor({ start, handle, onAdopt, onReload }: LoadedPostEditorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { editor, getDoc } = handle;
  const [overlay, setOverlay] = useState<EditorOverlay>(
    start.restore === "conflict" ? "conflict" : null,
  );
  const [tab, setTab] = useState<SideTab>("postInfo");
  // 미리보기는 연 순간의 문서를 그린다 — 렌더마다 읽으면 요청이 되풀이된다
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const uploadImage = useImageUploader();
  const categories = useQuery({
    queryKey: POST_CATEGORIES_QUERY_KEY,
    queryFn: fetchPostCategories,
  });
  const form = usePostForm(start);
  const server = useServerSave({
    getDoc,
    start,
    form,
    onAdopt,
    onConflict: () => setOverlay("conflict"),
  });
  // 자기 글은 제목 중복 비교에서 뺀다 — 주소를 바꾼 초안의 옛 주소도 자기 글이다
  const publishCheck = usePublishCheck(getDoc, [form.slug, start.slug, server.savedSlug()]);
  const autosave = useAutosave({
    editor,
    save: server.save,
    shouldSaveSoon: start.restore === "restore",
  });

  const handleMetaChange = (patch: EditableMeta) => {
    form.changeMeta(patch);
    autosave.schedule();
  };
  const handleTitleChange = (title: string) => {
    form.changeTitle(title, server.savedSlug() === null);
    autosave.schedule();
  };
  const handleSlugChange = (slug: string) => {
    form.changeSlug(slug);
    server.clearSlugError();
    autosave.schedule();
  };

  const openPublish = () => {
    publishCheck.captureDoc();
    setOverlay("publish");
  };

  const handleSaveDraft = () => {
    if (server.isPublished) openPublish();
    else void autosave.flush();
  };
  useSaveShortcut(handleSaveDraft);

  const handleBack = async () => {
    if (server.isPublished) server.keepLocalDraft();
    else await autosave.flush().catch(() => undefined);
    void navigate(ROUTES.home);
  };

  const handleRelogin = () => {
    server.keepLocalDraft();
    void navigate(loginPathFor(`${location.pathname}${location.search}`));
  };

  const handleOpenPreview = () => {
    const doc = readDocOrNull(getDoc);
    if (doc === null) return;
    setPreviewDoc(doc);
    setOverlay("preview");
  };

  const conflict = useConflictActions({
    editor,
    server,
    autosave,
    onClose: () => setOverlay(null),
    onReload,
  });

  const handleConfirmPublish = () => {
    setOverlay(null);
    void autosave.run("publish");
  };

  return (
    <>
      <EditorScreen
        editor={editor}
        stickerSrc={stickerSrc}
        uploadImage={uploadImage}
        tab={tab}
        onTabChange={setTab}
        status={<SaveStatusLine status={server.status} onRetry={() => void autosave.flush()} />}
        banner={server.isExpired ? <ExpiredBanner onRelogin={handleRelogin} /> : undefined}
        actions={{
          onBack: () => void handleBack(),
          onPreview: handleOpenPreview,
          onSaveDraft: handleSaveDraft,
          onPublish: openPublish,
        }}
        title={
          <TitleField
            title={form.meta.title}
            isAiDraft={form.meta.source !== "editor"}
            onTitleChange={handleTitleChange}
            onEnter={() => focusEditorStart(editor)}
          />
        }
        postInfo={
          <PostInfoPanel
            meta={form.meta}
            isPublished={server.isPublished}
            categories={categories.data ?? []}
            onMetaChange={handleMetaChange}
            onOpenDecorate={() => setTab("decorate")}
            slugField={
              <SlugField
                slug={form.slug}
                isLocked={server.isPublished}
                error={server.slugError}
                onChange={handleSlugChange}
              />
            }
          />
        }
      />
      <EditorDialogs
        overlay={overlay}
        form={form}
        isPublished={server.isPublished}
        previewDoc={previewDoc}
        publishDoc={publishCheck.publishDoc}
        otherPosts={publishCheck.otherPosts}
        actions={{
          onClose: () => setOverlay(null),
          ...conflict,
          onConfirmPublish: handleConfirmPublish,
        }}
      />
    </>
  );
}
