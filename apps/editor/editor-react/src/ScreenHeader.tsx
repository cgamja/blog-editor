import { useId, type ReactNode } from "react";
import { screenMessages } from "./screen-messages";
import type { EditorScreenActions } from "./screen-types";

export interface ScreenHeaderProps {
  actions: EditorScreenActions;
  status?: ReactNode;
}

interface HeaderActionProps {
  label: ReactNode;
  onPress: (() => void) | undefined;
  reasonId: string;
  className: string;
  children?: ReactNode;
}

/**
 * 동작이 없으면 `disabled` 대신 `aria-disabled`로 둔다 — disabled 버튼은 포커스를 잃어
 * 키보드 사용자가 이유(aria-describedby)를 읽을 수 없다(editor-screen-frame design.md 1).
 */
function HeaderAction({ label, onPress, reasonId, className, children }: HeaderActionProps) {
  const connected = onPress !== undefined;
  return (
    <button
      type="button"
      className={className}
      aria-disabled={connected ? undefined : true}
      aria-describedby={connected ? undefined : reasonId}
      onClick={onPress}
    >
      {children}
      {label}
    </button>
  );
}

/** 편집 화면 머리줄(디자인 68:2) — ← 글 목록 · 저장 상태 · 미리보기 · 초안 저장 · 발행 */
export function ScreenHeader({ actions, status }: ScreenHeaderProps) {
  const reasonId = useId();
  return (
    <header className="editor-screen-header">
      <HeaderAction
        label={<span className="editor-screen-back-label">{screenMessages.back}</span>}
        onPress={actions.onBack}
        reasonId={reasonId}
        className="editor-screen-back"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </HeaderAction>
      <p className="editor-screen-status" role="status">
        {status}
      </p>
      <HeaderAction
        label={screenMessages.preview}
        onPress={actions.onPreview}
        reasonId={reasonId}
        className="editor-screen-button"
      />
      <HeaderAction
        label={screenMessages.saveDraft}
        onPress={actions.onSaveDraft}
        reasonId={reasonId}
        className="editor-screen-button"
      />
      <HeaderAction
        label={screenMessages.publish}
        onPress={actions.onPublish}
        reasonId={reasonId}
        className="editor-screen-button editor-screen-button-primary"
      />
      <span id={reasonId} hidden>
        {screenMessages.notConnected}
      </span>
    </header>
  );
}
