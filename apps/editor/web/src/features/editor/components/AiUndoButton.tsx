import { EDITOR_MESSAGES } from "../messages";

export interface AiUndoButtonProps {
  onPress: () => void;
}

/** 머리줄 「AI 수정 되돌리기」 — 되돌릴 수 있는 AI 저장이 있을 때만 그린다(ADR-041) */
export function AiUndoButton({ onPress }: AiUndoButtonProps) {
  return (
    <button type="button" className="editor-ai-undo" onClick={onPress}>
      {EDITOR_MESSAGES.aiUndo.button}
    </button>
  );
}
