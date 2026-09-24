import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Doc, PostFile, PostMeta } from "@blog-editor/content-schema";
import { SESSION_EXPIRY_META } from "../../../shared/api/constants";
import { renamePost, savePost } from "../api";
import { browserDrafts, writeLocalDraft } from "../local-draft";
import { createPostSaver, type PostSaver } from "../post-saver";
import type { EditingStart, SaveStatus } from "../types";

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

/**
 * 편집 화면의 서버 저장 — 저장 · 주소 바꾸기 mutation을 `createPostSaver`에 잇고 그 알림을 화면 상태로 옮긴다.
 * 저장 한 번마다 쓰던 글을 브라우저 localDraft에 남기고 성공하면 지운다(부수 효과, `PostSaver.save`).
 * 서버 쪽 진실(주소 · revision · 발행 여부)은 saver가 닫힌 값으로 가진다 — 여기 상태는 그리기용 사본이다.
 */
export function useServerSave({ getDoc, start, form, onAdopt, onConflict }: UseServerSaveOptions) {
  const [isPublished, setPublished] = useState(start.isPublished);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [isExpired, setExpired] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

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

  // saver는 한 번 만들고, 매 렌더의 값(입력 · 콜백 · mutation)은 ref로 읽는다
  const latest = useRef({ form, getDoc, onAdopt, onConflict, saveMutation, renameMutation });
  latest.current = { form, getDoc, onAdopt, onConflict, saveMutation, renameMutation };
  // 떠난 화면에서 끝난 저장이 주소를 옮기지 않게 한다
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [saver] = useState<PostSaver>(() =>
    createPostSaver(start, {
      getDoc: () => latest.current.getDoc(),
      readForm: () => latest.current.form,
      savePost: (slug, file, revision) =>
        latest.current.saveMutation.mutateAsync({ slug, file, revision }),
      renamePost: (from, to, revision) =>
        latest.current.renameMutation.mutateAsync({ from, to, revision }),
      drafts: browserDrafts,
      events: {
        onStatus: setStatus,
        onAdopt: (slug) => {
          if (isMounted.current) latest.current.onAdopt(slug);
        },
        onConflict: () => latest.current.onConflict(),
        onExpiredChange: setExpired,
        onSlugError: setSlugError,
        onPublished: () => setPublished(true),
      },
    }),
  );

  return {
    status,
    isPublished,
    isExpired,
    slugError,
    save: saver.save,
    clearSlugError: () => setSlugError(null),
    pause: saver.pause,
    prepareOverwrite: saver.prepareOverwrite,
    /** 화면을 떠나기 전(다시 로그인 · 발행 글에서 글 목록) 쓰던 글을 브라우저에 남긴다 */
    keepLocalDraft: () => {
      try {
        writeLocalDraft(saver.localKey(), saver.currentDraft());
      } catch {
        // 닫힌 집합을 어기는 문서 — 마지막으로 남긴 글이 그대로 있다
      }
    },
    currentDraft: saver.currentDraft,
    savedSlug: saver.savedSlug,
    localKey: saver.localKey,
  };
}

export type ServerSave = ReturnType<typeof useServerSave>;
