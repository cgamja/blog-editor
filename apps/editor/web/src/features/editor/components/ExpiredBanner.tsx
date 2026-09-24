import { EDITOR_MESSAGES } from "../messages";

/** 세션 만료 띠(디자인 결정 4-A) — 쓰던 글은 브라우저에 남아 있고, 다시 로그인하면 이 글로 돌아온다 */
export function ExpiredBanner({ onRelogin }: { onRelogin: () => void }) {
  return (
    <div className="editor-expired" role="alert">
      <span>{EDITOR_MESSAGES.expired.text}</span>
      <button type="button" className="editor-expired-action" onClick={onRelogin}>
        {EDITOR_MESSAGES.expired.action}
      </button>
    </div>
  );
}
