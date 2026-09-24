import { IMPORT_MESSAGES as M } from "../messages";
import { previewDocument } from "../preview-document";
import type { ImportPreview } from "../types";

interface ImportPreviewPaneProps {
  hasText: boolean;
  isPending: boolean;
  /** 미리보기 요청이 실패했을 때 보일 문장 — 없으면 null */
  errorMessage: string | null;
  result: ImportPreview | null;
}

function Blocked({ messages }: { messages: readonly string[] }) {
  return (
    <div className="import-blocked" role="alert">
      <p className="import-blocked-title">{M.blocked(messages.length)}</p>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewBody({ hasText, errorMessage, result }: Omit<ImportPreviewPaneProps, "isPending">) {
  if (!hasText) return <p className="import-placeholder">{M.previewEmpty}</p>;
  if (errorMessage !== null) {
    return (
      <p className="import-error" role="alert">
        {errorMessage}
      </p>
    );
  }
  if (result === null) return <p className="import-placeholder">{M.previewLoading}</p>;
  if (!result.ok) return <Blocked messages={result.messages} />;
  return (
    <iframe
      className="import-frame"
      title={M.previewFrameTitle}
      sandbox=""
      srcDoc={previewDocument(result.html)}
    />
  );
}

/** 오른쪽 칸 — 미리보기 또는 막는 메시지(줄 번호 · 이유) */
export function ImportPreviewPane({
  hasText,
  isPending,
  errorMessage,
  result,
}: ImportPreviewPaneProps) {
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
      <PreviewBody hasText={hasText} errorMessage={errorMessage} result={result} />
    </div>
  );
}
