import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { Doc } from "@blog-editor/content-schema";
import {
  EditorScreen,
  focusEditorStart,
  useBlogEditor,
  type SideTab,
  type StickerId,
} from "@blog-editor/editor-react";
import { ROUTES } from "../../../shared/routes/constants";
import { loginPathFor } from "../../../shared/routes/next-path";
import { fetchPostCategories } from "../api";
import { POST_LIST_QUERY_KEY } from "../constants";
import { EDITOR_MESSAGES } from "../messages";
import { useAutosave } from "../hooks/use-autosave";
import { useConflictActions } from "../hooks/use-conflict-actions";
import { useImageUploader } from "../hooks/use-image-uploader";
import { usePostForm, type EditableMeta } from "../hooks/use-post-form";
import { useSaveShortcut } from "../hooks/use-save-shortcut";
import { useServerSave } from "../hooks/use-server-save";
import type { EditingStart, EditorOverlay } from "../types";
import { EditorDialogs } from "./EditorDialogs";
import { ExpiredBanner } from "./ExpiredBanner";
import { PostInfoPanel } from "./PostInfoPanel";
import { SaveStatusLine } from "./SaveStatusLine";
import { SlugField } from "./SlugField";
import { TitleField } from "./TitleField";

/** 스티커 원본 — 개발 서버는 content-render assets를 `/stickers/`로 서빙한다(vite publicDir, 배포는 M4) */
const stickerSrc = (id: StickerId) => `/stickers/${id}.png`;

export interface PostEditorProps {
  /** 처음 한 번만 읽는다 — 뒤의 진실은 에디터와 저장 흐름이다 */
  initialStart: EditingStart;
  onAdopt: (slug: string) => void;
  /** 「내 글을 복사해 두고 최신 글 열기」 — 최신 글로 에디터를 새로 만든다 */
  onReload: (slug: string) => void;
}

/**
 * 편집 화면 한 벌(디자인 68:2) — 틀은 editor-react `EditorScreen`. 입력(`usePostForm`) · 서버 저장
 * (`useServerSave`) · 저장 줄(`useAutosave`)을 여기서 잇는다.
 */
export function PostEditor({ initialStart, onAdopt, onReload }: PostEditorProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [start] = useState(initialStart);
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
  const form = usePostForm(start);
  const server = useServerSave({
    getDoc,
    start,
    form,
    onAdopt,
    onConflict: () => setOverlay("conflict"),
  });
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

  const handleSaveDraft = () => {
    if (server.isPublished) setOverlay("publish");
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
    try {
      setPreviewDoc(getDoc());
      setOverlay("preview");
    } catch {
      // 닫힌 집합을 어기는 문서 — 저장도 같은 이유로 실패하고 머리줄이 알린다
    }
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
          onPublish: () => setOverlay("publish"),
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
        actions={{
          onClose: () => setOverlay(null),
          ...conflict,
          onConfirmPublish: handleConfirmPublish,
        }}
      />
    </>
  );
}
