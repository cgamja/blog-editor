import type { KeyboardEvent } from "react";
import { EDITOR_MESSAGES } from "../messages";

export interface TitleFieldProps {
  title: string;
  /** AI(MCP)가 올린 초안이면 포스트잇(디자인 68:2) */
  isAiDraft: boolean;
  onTitleChange: (title: string) => void;
  /** Enter — 본문 맨 앞으로 */
  onEnter: () => void;
}

/**
 * 종이 위 글 제목(디자인 68:2의 h1 자리). 제목은 문서 블록이 아니라 글 메타라 에디터 밖의 입력 칸이다.
 * 조합 중 Enter(keyCode 229)는 한글 확정이라 넘기지 않는다.
 */
export function TitleField({ title, isAiDraft, onTitleChange, onEnter }: TitleFieldProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onEnter();
  };
  return (
    <div className="post-title">
      {isAiDraft && <p className="post-title-note">{EDITOR_MESSAGES.aiDraftNote}</p>}
      <textarea
        className="post-title-input"
        aria-label={EDITOR_MESSAGES.titleLabel}
        placeholder={EDITOR_MESSAGES.titlePlaceholder}
        rows={1}
        value={title}
        onChange={(event) => onTitleChange(event.target.value.replace(/\n/g, " "))}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
