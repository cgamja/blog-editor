import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { SCHEMA_VERSION } from "@blog-editor/content-schema";
import type { Doc, PostFile, PostMeta } from "@blog-editor/content-schema";
import { isEditorComposing, useDocChange } from "@blog-editor/editor-react";
import type { BlogEditorInstance } from "@blog-editor/editor-react";
import { ApiError } from "../../../shared/api/errors";
import { SESSION_EXPIRY_META } from "../../../shared/api/constants";
import { renamePost, savePost } from "../api";
import { createAutosave } from "../autosave";
import { AUTOSAVE_DELAY_MS, NEW_POST_KEY } from "../constants";
import { todayIsoDate } from "../editing-start";
import { clearLocalDraft, writeLocalDraft } from "../local-draft";
import { EDITOR_MESSAGES } from "../messages";
import { missingForSave } from "../post-meta";
import { saveErrorKindOf } from "../save-model";
import { suggestSlug } from "../slug";
import type { EditingStart, LocalDraft, SaveStatus } from "../types";

const HTTP_CONFLICT = 409;
// 저장이 401이면 띠로 알린다 — 전역 처리가 로그인 화면으로 곧장 보내면 쓰던 글을 두고 떠난다(design 3)
const KEEP_SESSION = { [SESSION_EXPIRY_META]: false };

export type SaveMode = "draft" | "publish";

export interface UsePostSaveOptions {
  editor: BlogEditorInstance;
  getDoc: () => Doc;
  start: EditingStart;
  /** 화면이 스스로 새 주소로 옮긴다(새 글의 첫 저장 · 주소 바꾸기) — 에디터는 그대로 둔다 */
  onAdopt: (slug: string) => void;
  /** 서버가 먼저 바뀌었다(409) */
  onConflict: () => void;
}

interface ServerState {
  savedSlug: string | null;
  revision: string | null;
}

/**
 * 편집 화면의 글 정보 · 저장 흐름(edit-screen design 2 · 3). 문서의 진실은 에디터 하나이고, 이 훅은 메타와
 * 서버 쪽 상태(주소 · revision)만 가진다. 저장은 한 번에 하나 — `createAutosave`가 줄을 세운다.
 */
export function usePostSave({ editor, getDoc, start, onAdopt, onConflict }: UsePostSaveOptions) {
  const [meta, setMeta] = useState<PostMeta>(start.meta);
  const [slug, setSlugValue] = useState(start.slug);
  const [isSlugEdited, setSlugEdited] = useState(start.slug !== "");
  const [isPublished, setPublished] = useState(start.isPublished);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [isExpired, setExpired] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const server = useRef<ServerState>({ savedSlug: start.savedSlug, revision: start.revision });
  // 비동기 저장이 끝났을 때 읽는 지금 값 — 렌더마다 갱신한다
  const latest = useRef({ meta, slug, isPublished, isExpired });
  latest.current = { meta, slug, isPublished, isExpired };
  // 충돌에서 「저장하지 않고 계속 쓰기」를 고르면 서버 저장을 멈춘다 — localDraft는 계속 쓴다
  const isPaused = useRef(start.restore === "conflict");

  const saveMutation = useMutation({
    mutationFn: (input: { slug: string; file: PostFile; revision: string | null }) =>
      savePost(input.slug, input.file, input.revision),
    meta: KEEP_SESSION,
  });
  const renameMutation = useMutation({
    mutationFn: (input: { from: string; to: string; revision: string }) =>
      renamePost(input.from, input.to, input.revision),
    meta: KEEP_SESSION,
  });

  const localKey = () => server.current.savedSlug ?? NEW_POST_KEY;

  const localDraftOf = (doc: Doc): LocalDraft => ({
    baseRevision: server.current.revision,
    slug: latest.current.slug,
    meta: latest.current.meta,
    doc,
    savedAt: new Date().toISOString(),
  });

  /** 주소가 바뀌었으면 먼저 옮긴다. 409면 주소 칸에 서버 문장을 보이고 false */
  const moveIfRenamed = async (to: string): Promise<boolean> => {
    const { savedSlug, revision } = server.current;
    if (savedSlug === null || savedSlug === to || revision === null) return true;
    try {
      const moved = await renameMutation.mutateAsync({ from: savedSlug, to, revision });
      clearLocalDraft(savedSlug);
      server.current = { savedSlug: to, revision: moved };
      onAdopt(to);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === HTTP_CONFLICT) {
        setSlugError(error.userMessage ?? EDITOR_MESSAGES.info.slugTaken);
        setStatus({ kind: "failed", message: null });
        return false;
      }
      throw error;
    }
  };

  const handleFailure = (error: unknown) => {
    const kind = saveErrorKindOf(error, server.current.savedSlug === null);
    if (kind === "expired") setExpired(true);
    if (kind === "slugTaken") setSlugError(EDITOR_MESSAGES.info.slugTaken);
    if (kind === "conflict") onConflict();
    const message = kind === "rejected" && error instanceof ApiError ? error.userMessage : null;
    setStatus({ kind: "failed", message });
  };

  const save = async (mode: SaveMode): Promise<void> => {
    let doc: Doc;
    try {
      doc = getDoc();
    } catch {
      setStatus({ kind: "failed", message: null });
      return;
    }
    writeLocalDraft(localKey(), localDraftOf(doc));
    const current = latest.current;
    // 발행 글은 자동 저장하지 않는다 — 저장이 곧 공개 글 변경이다(design 2)
    if (mode === "draft" && (current.isPublished || isPaused.current || current.isExpired)) return;

    const missing = missingForSave(current.meta, current.slug);
    if (missing.length > 0) {
      setStatus({ kind: "incomplete", missing });
      return;
    }
    const willPublish = mode === "publish" || current.isPublished;
    const file: PostFile = {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        ...current.meta,
        draft: !willPublish,
        ...(current.isPublished ? { updated: todayIsoDate() } : {}),
      },
      doc,
    };
    setStatus({ kind: "saving" });
    try {
      if (!(await moveIfRenamed(current.slug))) return;
      const wasNew = server.current.savedSlug === null;
      const revision = await saveMutation.mutateAsync({
        slug: current.slug,
        file,
        revision: server.current.revision,
      });
      clearLocalDraft(localKey());
      server.current = { savedSlug: current.slug, revision };
      if (wasNew) onAdopt(current.slug);
      isPaused.current = false;
      setSlugError(null);
      setExpired(false);
      if (willPublish && !current.isPublished) {
        setPublished(true);
        setMeta((previous) => ({ ...previous, draft: false }));
        setStatus({ kind: "published" });
      } else {
        setStatus({ kind: "saved", at: new Date(), isPublished: willPublish });
      }
    } catch (error) {
      handleFailure(error);
    }
  };

  const saveRef = useRef(save);
  saveRef.current = save;

  const autosave = useMemo(
    () =>
      createAutosave({
        delayMs: AUTOSAVE_DELAY_MS,
        isComposing: () => isEditorComposing(editor),
        save: () => saveRef.current("draft"),
      }),
    [editor],
  );

  useDocChange(
    editor,
    useCallback(() => autosave.schedule(), [autosave]),
  );

  useEffect(() => {
    // 되살린 글은 서버보다 새것이다 — 곧 저장한다
    if (start.restore === "restore") autosave.schedule();
    return () => autosave.dispose();
  }, [autosave, start.restore]);

  const changeMeta = (patch: Partial<PostMeta>) => {
    setMeta((previous) => ({ ...previous, ...patch }));
    // 새 글은 제목에서 주소를 제안한다 — 사람이 주소를 고쳤거나 이미 저장된 글이면 두지 않는다
    if (patch.title !== undefined && !isSlugEdited && server.current.savedSlug === null) {
      setSlugValue(suggestSlug(patch.title));
    }
    autosave.schedule();
  };

  const changeSlug = (next: string) => {
    setSlugValue(next);
    setSlugEdited(true);
    setSlugError(null);
    autosave.schedule();
  };

  return {
    meta,
    slug,
    status,
    isPublished,
    isExpired,
    slugError,
    changeMeta,
    changeSlug,
    /** ⌘S · 「초안 저장」 · 다시 시도 — 기다리지 않는다 */
    saveNow: () => autosave.flush(),
    publish: () => save("publish"),
    /** 「저장하지 않고 계속 쓰기」 */
    pause: () => {
      isPaused.current = true;
      setStatus({ kind: "failed", message: null });
    },
    /** 「덮어쓰기」 — 최신 revision 위에 내 글을 저장한다 */
    overwriteWith: (revision: string) => {
      server.current = { ...server.current, revision };
      isPaused.current = false;
      return save(latest.current.isPublished ? "publish" : "draft");
    },
    currentDraft: () => localDraftOf(getDoc()),
    savedSlug: () => server.current.savedSlug,
    localKey,
  };
}
