import { EDITOR_MESSAGES } from "../messages";

/**
 * 다른 곳(AI)에서 바뀐 판을 알리는 띠(openspec editor-live-reflect) — 저장 안 한 고침이 있을 때만 뜬다.
 * 「불러오기」는 지금 고친 것을 버리고 새 판으로 바꿔 끼운다. 모양은 세션 만료 띠(ExpiredBanner)와 같다.
 */
export function LiveReflectBanner({ onLoad }: { onLoad: () => void }) {
  return (
    <div className="editor-banner" role="alert">
      <span>{EDITOR_MESSAGES.liveReflect.text}</span>
      <button type="button" className="editor-banner-action" onClick={onLoad}>
        {EDITOR_MESSAGES.liveReflect.action}
      </button>
    </div>
  );
}
