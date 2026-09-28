import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConflictError } from "../../../shared/api/errors";
import { fetchAiUndo, revertAiEdit } from "../api";
import { aiUndoQueryKey, aiUndoQueryPrefix } from "../constants";
import { clearLocalDraft } from "../local-draft";
import type { Autosave } from "../autosave";
import type { ServerSave } from "./use-server-save";

export interface UseAiUndoOptions {
  server: ServerSave;
  autosave: Autosave;
  /** 판이 그사이 바뀌었다(409) — 충돌 대화상자로 */
  onConflict: () => void;
  /** 되돌린 판으로 에디터를 새로 만든다 */
  onReload: (slug: string) => void;
}

/** 되돌릴 판(If-Match)이 없다 — 서버에 없는 글. 버튼은 서버에 있는 글에만 뜨므로 배선이 틀린 것이다 */
class NotSavedYetError extends Error {
  constructor() {
    super("아직 서버에 없는 글");
    this.name = "NotSavedYetError";
  }
}

/**
 * 편집 화면의 AI 수정 되돌리기(openspec ai-undo · ADR-041). 서버에 있는 초안이고, 내가 가진 판이 지금 판이며
 * 되돌릴 수 있을 때만 버튼을 보인다. 가능 여부는 판(revision)마다 다시 묻는다 — 내가 저장하거나 다른 곳의 판을
 * 받아들이면(live-reflect) 판이 바뀌어 다시 묻는다.
 */
export function useAiUndo({ server, autosave, onConflict, onReload }: UseAiUndoOptions) {
  const queryClient = useQueryClient();
  const slug = server.savedSlug();
  const revision = server.revision();
  const canAsk = slug !== null && revision !== null && !server.isPublished;
  const query = useQuery({
    queryKey: aiUndoQueryKey(slug ?? "", revision ?? ""),
    queryFn: () => fetchAiUndo(slug ?? "", revision ?? ""),
    // 실패하면 버튼을 숨길 뿐이다 — 화면을 막지 않는다(data가 없으면 isAvailable false)
    enabled: canAsk,
  });
  const forget = (target: string) =>
    queryClient.invalidateQueries({ queryKey: aiUndoQueryPrefix(target) });

  const mutation = useMutation({
    mutationFn: async (target: string) => {
      // 보내는 중인 저장이 있으면 끝나기를 기다린 뒤 그 저장이 돌려준 판을 보낸다 — 옛 판이면 409뿐이다
      await autosave.settled();
      // 줄이 비며 다시 맞춘 시계(저장 중에 바뀐 글)도 치운다 — 되돌리기가 그 글을 버린다
      autosave.dispose();
      const current = server.revision();
      if (current === null) throw new NotSavedYetError();
      return revertAiEdit(target, current);
    },
    onSuccess: (_revision, target) => {
      clearLocalDraft(server.localKey());
      void forget(target);
      onReload(target);
    },
    onError: (error, target) => {
      void forget(target);
      if (error instanceof ConflictError) {
        onConflict();
        return;
      }
      // 되돌리지 못했으면 치운 자동 저장을 다시 맞춘다 — 쓰던 글은 그대로 남아 있다
      if (server.hasUnsavedChanges()) autosave.schedule();
    },
  });

  return {
    isAvailable: canAsk && query.data === true,
    isReverting: mutation.isPending,
    isFailed: mutation.isError && !(mutation.error instanceof ConflictError),
    /** 대화상자를 닫을 때 — 지난 실패 문장을 지운다 */
    clearFailure: mutation.reset,
    /**
     * 쓰던 글을 버리고 되돌린다 — 기다리던 자동 저장을 치우고(보내는 중인 것은 기다린다), 성공하면 남긴 글
     * (localDraft)도 지운 뒤 되돌린 판을 다시 불러온다(「최신 글 열기」와 같은 길)
     */
    discardAndRevert: () => {
      const target = server.savedSlug();
      if (target === null || mutation.isPending) return;
      autosave.dispose();
      mutation.mutate(target);
    },
  };
}

export type AiUndo = ReturnType<typeof useAiUndo>;
