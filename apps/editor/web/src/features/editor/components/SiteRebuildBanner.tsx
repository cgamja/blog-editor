import { EDITOR_MESSAGES } from "../messages";

/**
 * 사이트 반영 실패 띠(openspec site-rebuild) — 발행 관련 저장 뒤 재빌드 훅이 실패했다. 「다시 시도」는 묶지 않고
 * 바로 훅을 부른다. 모양은 다른 곳 고침 띠(LiveReflectBanner)와 같다.
 */
export function SiteRebuildBanner({
  isRetrying,
  onRetry,
}: {
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="editor-banner" role="alert">
      <span>{EDITOR_MESSAGES.siteRebuild.failed}</span>
      <button
        type="button"
        className="editor-banner-action"
        onClick={onRetry}
        disabled={isRetrying}
      >
        {EDITOR_MESSAGES.siteRebuild.retry}
      </button>
    </div>
  );
}
