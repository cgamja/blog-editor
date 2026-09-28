import type { BlogEditorInstance } from "@blog-editor/editor-react";
import type { Autosave } from "../autosave";
import type { AiUndo } from "./use-ai-undo";
import { useConflictActions } from "./use-conflict-actions";
import type { ServerSave } from "./use-server-save";

export interface UseEditorDialogActionsOptions {
  editor: BlogEditorInstance;
  server: ServerSave;
  autosave: Autosave;
  aiUndo: AiUndo;
  /** 대화상자를 닫는다 */
  onClose: () => void;
  /** 최신 글로 에디터를 새로 만든다 */
  onReload: (slug: string) => void;
}

/** 편집 화면 대화상자의 선택지 — 충돌 세 선택지 · 발행 확인 · AI 수정 되돌리기 */
export function useEditorDialogActions({
  editor,
  server,
  autosave,
  aiUndo,
  onClose,
  onReload,
}: UseEditorDialogActionsOptions) {
  const conflict = useConflictActions({ editor, server, autosave, onClose, onReload });
  return {
    onClose,
    ...conflict,
    onConfirmPublish: () => {
      onClose();
      void autosave.run("publish");
    },
    onConfirmAiUndo: aiUndo.discardAndRevert,
    onCancelAiUndo: () => {
      aiUndo.clearFailure();
      onClose();
    },
  };
}
