import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
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
import { useAiUndo } from "../hooks/use-ai-undo";
import { useAutosave } from "../hooks/use-autosave";
import { useEditorDialogActions } from "../hooks/use-editor-dialog-actions";
import { useEditorSeo } from "../hooks/use-editor-seo";
import { useImageUploader } from "../hooks/use-image-uploader";
import { useLiveReflect } from "../hooks/use-live-reflect";
import { usePostCategories } from "../hooks/use-post-categories";
import { usePostForm } from "../hooks/use-post-form";
import { usePublishCheck } from "../hooks/use-publish-check";
import { useSaveShortcut } from "../hooks/use-save-shortcut";
import { useServerSave } from "../hooks/use-server-save";
import { createPostFieldHandlers } from "../post-field-handlers";
import { readDocOrNull } from "../read-doc";
import type { EditingStart, EditorOverlay } from "../types";
import { AiUndoButton } from "./AiUndoButton";
import { EditorDialogs } from "./EditorDialogs";
import { ExpiredBanner } from "./ExpiredBanner";
import { LiveReflectBanner } from "./LiveReflectBanner";
import { PostInfoPanel } from "./PostInfoPanel";
import { SaveStatusLine } from "./SaveStatusLine";
import { SeoChip } from "./SeoChip";
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
  const openConflict = () => setOverlay("conflict");
  const closeOverlay = () => setOverlay(null);
  const [tab, setTab] = useState<SideTab>("postInfo");
  // 미리보기는 연 순간의 문서를 그린다 — 렌더마다 읽으면 요청이 되풀이된다
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const uploadImage = useImageUploader();
  const categories = usePostCategories();
  const form = usePostForm(start);
  const server = useServerSave({ getDoc, start, form, onAdopt, onConflict: openConflict });
  // 자기 글은 제목 중복 비교에서 뺀다 — 주소를 바꾼 초안의 옛 주소도 자기 글이다
  const publishCheck = usePublishCheck(getDoc, [form.slug, start.slug, server.savedSlug()]);
  const seo = useEditorSeo({
    editor,
    getDoc,
    post: form,
    others: publishCheck.others,
    openTab: setTab,
  });
  const live = useLiveReflect({ editor, getDoc, server, form, isOverlayOpen: overlay !== null });
  const autosave = useAutosave({
    editor,
    save: server.save,
    shouldSaveSoon: start.restore === "restore",
  });

  const fields = createPostFieldHandlers({ form, server, autosave });

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

  const aiUndo = useAiUndo({ server, autosave, onConflict: openConflict, onReload });
  const dialogActions = useEditorDialogActions({
    editor,
    server,
    autosave,
    aiUndo,
    onClose: closeOverlay,
    onReload,
  });

  // 세션 만료가 먼저다 — 다시 로그인해야 불러오기도 된다
  const liveBanner = live.notice === null ? undefined : <LiveReflectBanner onLoad={live.load} />;
  const banner = server.isExpired ? <ExpiredBanner onRelogin={handleRelogin} /> : liveBanner;

  return (
    <>
      <EditorScreen
        editor={editor}
        stickerSrc={stickerSrc}
        uploadImage={uploadImage}
        tab={tab}
        onTabChange={setTab}
        status={<SaveStatusLine status={server.status} onRetry={() => void autosave.flush()} />}
        headerTools={
          <>
            {aiUndo.isAvailable && <AiUndoButton onPress={() => setOverlay("aiUndo")} />}
            <SeoChip check={seo.check} isStale={seo.isStale} onChoose={seo.jumpTo} />
          </>
        }
        blockFlags={seo.blockFlags}
        banner={banner}
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
            onTitleChange={fields.handleTitleChange}
            onEnter={() => focusEditorStart(editor)}
            inputRef={seo.fieldRefs.title}
          />
        }
        postInfo={
          <PostInfoPanel
            meta={form.meta}
            isPublished={server.isPublished}
            categories={categories}
            onMetaChange={fields.handleMetaChange}
            onOpenDecorate={() => setTab("decorate")}
            fieldRefs={seo.fieldRefs}
            slugField={
              <SlugField
                slug={form.slug}
                isLocked={server.isPublished}
                error={server.slugError}
                onChange={fields.handleSlugChange}
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
        others={publishCheck.others}
        aiUndo={aiUndo}
        actions={dialogActions}
      />
    </>
  );
}
