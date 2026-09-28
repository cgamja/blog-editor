import { useCallback, useEffect, useRef, useState } from "react";
import { focusEditorBlock, isEditorComposing, replaceEditorDoc } from "@blog-editor/editor-react";
import type { BlogEditorInstance } from "@blog-editor/editor-react";
import type { Doc } from "@blog-editor/content-schema";
import { LIVE_REFLECT_DEFER_MS } from "../constants";
import { changedTopBlocks, liveReflectActionOf } from "../live-reflect";
import { readDocOrNull } from "../read-doc";
import type { LoadedPost } from "../types";
import type { LiveRevision } from "./use-live-revision-query";
import type { PostForm } from "./use-post-form";
import type { ServerSave } from "./use-server-save";

export interface UseLiveReflectDecisionOptions {
  editor: BlogEditorInstance;
  getDoc: () => Doc;
  server: ServerSave;
  form: PostForm;
  /** 대화상자(충돌 · 발행 확인 · 미리보기)가 떠 있다 — 그 사이에는 판단하지 않는다 */
  isOverlayOpen: boolean;
  /** 새로 읽은 서버 판(`useLiveRevisionQuery`) */
  revision: { data: LiveRevision | undefined; dataUpdatedAt: number };
}

/**
 * 새로 읽은 서버 판을 어떻게 할지 정한다(openspec editor-live-reflect) — 새 판이면 저장 안 한 고침이 없을 때
 * 바꿔 끼우고, 있으면 띠(`notice`)로 알린다. 띠가 떠 있는 동안 자동 저장을 붙잡는다(`PostSaver.hold`).
 */
export function useLiveReflectDecision({
  editor,
  getDoc,
  server,
  form,
  isOverlayOpen,
  revision,
}: UseLiveReflectDecisionOptions) {
  const [notice, setNotice] = useState<LoadedPost | null>(null);

  const { hold } = server;
  useEffect(() => {
    hold(notice !== null);
  }, [hold, notice]);

  /** 서버 판으로 바꿔 끼운다 — 바뀐 최상위 블록 번호를 돌려주고, 못 끼웠으면 null */
  const replace = useCallback(
    (post: LoadedPost): number[] | null => {
      const savedSlug = server.savedSlug();
      if (savedSlug === null) return null;
      const before = readDocOrNull(getDoc);
      const after = post.file.doc;
      const changed =
        before === null ? after.content.map((_, index) => index) : changedTopBlocks(before, after);
      try {
        replaceEditorDoc(editor, after, changed);
      } catch {
        // 닫힌 집합을 어기는 서버 판 — 지금 본문을 지킨다
        return null;
      }
      const next = { meta: post.file.meta, slug: savedSlug };
      form.replace(next.meta, next.slug);
      // 사람이 고르지 않은 바꿔 끼우기(손대지 않은 화면)든 「불러오기」든 쓰던 글은 이제 새 판이다
      server.adoptLatestAndDropDraft(post.revision, next);
      setNotice(null);
      return changed;
    },
    [editor, getDoc, form, server],
  );

  // 판단에 쓰는 값은 렌더마다 바뀐다 — 효과는 새로 읽은 판에만 반응한다
  const latest = useRef({ server, isOverlayOpen, replace });
  latest.current = { server, isOverlayOpen, replace };

  const { data, dataUpdatedAt } = revision;
  useEffect(() => {
    if (data === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const judge = () => {
      const current = latest.current;
      const { server: save } = current;
      // 대화상자 · 멈춤 · 세션 만료 중에는 그 흐름이 서버 판을 다룬다
      if (current.isOverlayOpen || save.isPaused() || save.isExpired) return;
      // 읽는 사이 내 저장이 오갔으면 이 판은 내 저장과 앞뒤가 섞였을 수 있다 — 다음 확인에 맡긴다
      if (save.isSending() || save.syncMark() !== data.mark) return;
      const action = liveReflectActionOf({
        serverRevision: data.post.revision,
        knownRevision: save.revision(),
        hasUnsavedChanges: save.hasUnsavedChanges(),
        isComposing: isEditorComposing(editor),
      });
      if (action === "ignore") setNotice(null);
      if (action === "notify") setNotice(data.post);
      if (action === "replace") current.replace(data.post);
      if (action === "defer") timer = setTimeout(judge, LIVE_REFLECT_DEFER_MS);
    };
    judge();
    return () => clearTimeout(timer);
  }, [data, dataUpdatedAt, editor]);

  return {
    /** 띠에 알릴 서버 판 — 없으면 null */
    notice,
    /**
     * 「불러오기」 — 지금 고친 것을 버리고 알린 판으로 바꿔 끼운 뒤 첫 바뀐 블록으로 초점을 옮긴다.
     * 조합 중이거나 저장을 보내는 중이면 아무것도 안 한다(보내는 저장이 끝나면 다음 확인이 다시 판단한다)
     */
    load: () => {
      if (notice === null || isEditorComposing(editor) || server.isSending()) return;
      const changed = replace(notice);
      if (changed !== null) focusEditorBlock(editor, changed[0] ?? 0);
    },
  };
}
