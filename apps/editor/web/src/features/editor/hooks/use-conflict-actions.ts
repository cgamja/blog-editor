import { useQueryClient } from "@tanstack/react-query";
import { editorPlainText } from "@blog-editor/editor-react";
import type { BlogEditorInstance } from "@blog-editor/editor-react";
import { latestPostQuery } from "../api";
import { clearLocalDraft, writeLocalCopy } from "../local-draft";
import type { Autosave } from "../autosave";
import type { ServerSave } from "./use-server-save";

export interface UseConflictActionsOptions {
  editor: BlogEditorInstance;
  server: ServerSave;
  autosave: Autosave;
  /** 대화상자를 닫는다 */
  onClose: () => void;
  /** 최신 글로 에디터를 새로 만든다 */
  onReload: (slug: string) => void;
}

/** 저장 충돌 대화상자(디자인 67:2)의 세 선택지 */
export function useConflictActions({
  editor,
  server,
  autosave,
  onClose,
  onReload,
}: UseConflictActionsOptions) {
  const queryClient = useQueryClient();
  return {
    /** 「내 글을 복사해 두고 최신 글 열기」 */
    onCopyAndOpenLatest: () => {
      const savedSlug = server.savedSlug();
      // 클립보드는 거부될 수 있다(권한 · 창 포커스) — 사본은 브라우저 저장소에도 남긴다
      navigator.clipboard?.writeText(editorPlainText(editor)).catch(() => undefined);
      writeLocalCopy(server.localKey(), server.currentDraft());
      clearLocalDraft(server.localKey());
      onClose();
      if (savedSlug !== null) onReload(savedSlug);
    },
    /** 「저장하지 않고 계속 쓰기」 */
    onKeepWriting: () => {
      onClose();
      server.pause();
    },
    /** 「최신 글을 버리고 내 글로 덮어쓰기」 — 최신 revision을 다시 받아, 실패한 저장과 같은 방식으로 */
    onOverwrite: () => {
      const savedSlug = server.savedSlug();
      onClose();
      if (savedSlug === null) return;
      void queryClient
        .fetchQuery(latestPostQuery(savedSlug))
        .then((latest) => autosave.run(server.prepareOverwrite(latest.revision)))
        .catch(() => server.pause());
    },
  };
}
