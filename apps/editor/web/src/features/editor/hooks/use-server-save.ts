import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { SCHEMA_VERSION } from "@blog-editor/content-schema";
import type { Doc, PostFile, PostMeta } from "@blog-editor/content-schema";
import { SESSION_EXPIRY_META } from "../../../shared/api/constants";
import { ApiError } from "../../../shared/api/errors";
import { renamePost, savePost } from "../api";
import { NEW_POST_KEY } from "../constants";
import { todayIsoDate } from "../editing-start";
import { clearLocalDraft, writeLocalDraft } from "../local-draft";
import { EDITOR_MESSAGES } from "../messages";
import { missingForSave } from "../post-meta";
import { renameErrorKindOf, saveErrorKindOf } from "../save-model";
import type { EditingStart, LocalDraft, SaveMode, SaveStatus } from "../types";

// 저장이 401이면 띠로 알린다 — 전역 처리가 로그인 화면으로 곧장 보내면 쓰던 글을 두고 떠난다(design 3)
const KEEP_SESSION = { [SESSION_EXPIRY_META]: false };

export interface UseServerSaveOptions {
  getDoc: () => Doc;
  start: EditingStart;
  /** 지금 입력 값 — 렌더마다 새 값이 온다 */
  form: { meta: PostMeta; slug: string };
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
 * 편집 화면의 서버 저장(edit-screen design 2 · 3) — 저장 · 주소 바꾸기 mutation과 서버 쪽 상태(주소 · revision).
 * 문서의 진실은 에디터 하나이고 입력 값은 `usePostForm`이 가진다. 저장 순서는 `useAutosave`의 줄이 정한다.
 */
export function useServerSave({ getDoc, start, form, onAdopt, onConflict }: UseServerSaveOptions) {
  const [isPublished, setPublished] = useState(start.isPublished);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [isExpired, setExpired] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const server = useRef<ServerState>({ savedSlug: start.savedSlug, revision: start.revision });
  // 비동기 저장이 끝났을 때 읽는 지금 값 — 렌더마다 갱신한다
  const latest = useRef({ ...form, isPublished, isExpired });
  latest.current = { ...form, isPublished, isExpired };
  // 충돌에서 「저장하지 않고 계속 쓰기」를 고르면 자동 저장을 멈춘다 — localDraft는 계속 쓴다
  const isPaused = useRef(start.restore === "conflict");
  // 충돌로 실패한 저장의 방식 — 「덮어쓰기」가 같은 방식으로 다시 한다(발행이 초안으로 바뀌지 않게)
  const failedMode = useRef<SaveMode | null>(null);
  // 떠난 화면에서 끝난 저장이 주소를 옮기지 않게 한다
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
  const adopt = (slug: string) => {
    if (isMounted.current) onAdopt(slug);
  };

  const localDraftOf = (doc: Doc): LocalDraft => ({
    baseRevision: server.current.revision,
    slug: latest.current.slug,
    meta: latest.current.meta,
    doc,
    savedAt: new Date().toISOString(),
  });

  /** 주소가 바뀌었으면 먼저 옮긴다. 발행 글 · 이미 있는 주소면 주소 칸에 서버 문장을 보이고 false */
  const moveIfRenamed = async (to: string): Promise<boolean> => {
    const { savedSlug, revision } = server.current;
    if (savedSlug === null || savedSlug === to || revision === null) return true;
    try {
      const moved = await renameMutation.mutateAsync({ from: savedSlug, to, revision });
      clearLocalDraft(savedSlug);
      server.current = { savedSlug: to, revision: moved };
      adopt(to);
      return true;
    } catch (error) {
      if (renameErrorKindOf(error) !== "slugRejected") throw error;
      const message = error instanceof ApiError ? error.userMessage : null;
      setSlugError(message ?? EDITOR_MESSAGES.info.slugTaken);
      setStatus({ kind: "failed", message: null });
      return false;
    }
  };

  const handleFailure = (error: unknown, mode: SaveMode) => {
    const kind = saveErrorKindOf(error, server.current.savedSlug === null);
    if (kind === "expired") setExpired(true);
    if (kind === "slugTaken") setSlugError(EDITOR_MESSAGES.info.slugTaken);
    if (kind === "conflict") {
      failedMode.current = mode;
      onConflict();
    }
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
      if (wasNew) adopt(current.slug);
      isPaused.current = false;
      failedMode.current = null;
      setSlugError(null);
      setExpired(false);
      if (willPublish && !current.isPublished) {
        setPublished(true);
        setStatus({ kind: "published" });
      } else {
        setStatus({ kind: "saved", at: new Date(), isPublished: willPublish });
      }
    } catch (error) {
      handleFailure(error, mode);
    }
  };

  return {
    status,
    isPublished,
    isExpired,
    slugError,
    save,
    clearSlugError: () => setSlugError(null),
    /** 「저장하지 않고 계속 쓰기」 */
    pause: () => {
      isPaused.current = true;
      setStatus({ kind: "failed", message: null });
    },
    /** 「덮어쓰기」 준비 — 최신 revision 위에 저장하고, 충돌로 실패한 저장의 방식을 돌려준다 */
    prepareOverwrite: (revision: string): SaveMode => {
      server.current = { ...server.current, revision };
      isPaused.current = false;
      return failedMode.current ?? (latest.current.isPublished ? "publish" : "draft");
    },
    /** 화면을 떠나기 전(다시 로그인 · 발행 글에서 글 목록) 쓰던 글을 브라우저에 남긴다 */
    keepLocalDraft: () => {
      try {
        writeLocalDraft(localKey(), localDraftOf(getDoc()));
      } catch {
        // 닫힌 집합을 어기는 문서 — 마지막으로 남긴 글이 그대로 있다
      }
    },
    currentDraft: () => localDraftOf(getDoc()),
    savedSlug: () => server.current.savedSlug,
    localKey,
  };
}

export type ServerSave = ReturnType<typeof useServerSave>;
