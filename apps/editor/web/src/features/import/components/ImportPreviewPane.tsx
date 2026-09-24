import tokensCss from "../../../styles/tokens.css?raw";
import { POST_CSS_PATH } from "../constants";
import { IMPORT_MESSAGES as M } from "../messages";
import type { ImportPreview } from "../types";

interface ImportPreviewPaneProps {
  hasText: boolean;
  isPending: boolean;
  isError: boolean;
  result: ImportPreview | null;
}

/**
 * 공개 렌더러 HTML을 스크립트 없는 샌드박스 iframe에 본문 CSS와 함께 넣는다 — 공개 페이지와 같은 모양이고,
 * 렌더 결과가 에디터 화면 스타일과 섞이지 않는다. post.css는 색 · 글꼴을 사이트 토큰 이름으로만 참조하므로
 * (content-render post.css 머리) 같은 이름의 에디터 토큰을 함께 싣는다. srcdoc 문서는 부모 주소로 상대 경로를 푼다.
 */
function previewDocument(html: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${tokensCss}body{margin:0;padding:var(--space-16);background:var(--surface)}</style><link rel="stylesheet" href="${POST_CSS_PATH}"></head><body>${html}</body></html>`;
}

/** 오른쪽 칸 — 미리보기 또는 막는 메시지(줄 번호 · 이유) */
export function ImportPreviewPane({ hasText, isPending, isError, result }: ImportPreviewPaneProps) {
  return (
    <div className="import-pane" aria-busy={isPending}>
      <div className="import-pane-head">
        <span className="modal-dialog-label">{M.preview}</span>
        {isPending && hasText ? (
          <span className="import-hint" role="status">
            {M.previewLoading}
          </span>
        ) : null}
      </div>
      {!hasText ? (
        <p className="import-placeholder">{M.previewEmpty}</p>
      ) : isError ? (
        <p className="import-error" role="alert">
          {M.previewFailed}
        </p>
      ) : result === null ? (
        <p className="import-placeholder">{M.previewLoading}</p>
      ) : result.ok ? (
        <iframe
          className="import-frame"
          title={M.previewFrameTitle}
          sandbox=""
          srcDoc={previewDocument(result.html)}
        />
      ) : (
        <div className="import-blocked" role="alert">
          <p className="import-blocked-title">{M.blocked(result.messages.length)}</p>
          <ul>
            {result.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
