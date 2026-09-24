import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Doc } from "@blog-editor/content-schema";
import { SESSION_EXPIRY_META } from "../../../shared/api/constants";
import { fetchPreviewHtml } from "../api";
import { POST_CSS_PATH } from "../constants";
import { EDITOR_MESSAGES } from "../messages";
import { ModalDialog } from "./ModalDialog";

export interface PreviewDialogProps {
  title: string;
  doc: Doc;
  onClose: () => void;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.codePointAt(0) ?? 0};`);

/**
 * 공개 페이지와 같은 문서 — 서버의 공개 렌더러 HTML(`POST /api/preview`)과 공개 `post.css`.
 * `sandbox`에 스크립트 허용이 없어 렌더러 밖의 것이 실행될 길이 없다. 같은 출처는 올린 이미지(CORP same-site) 때문이다.
 */
function previewDocument(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="${POST_CSS_PATH}"></head><body><article><h1>${escapeHtml(title)}</h1>${bodyHtml}</article></body></html>`;
}

export function PreviewDialog({ title, doc, onClose }: PreviewDialogProps) {
  const { preview } = EDITOR_MESSAGES;
  const { mutate, data, isError } = useMutation({
    mutationFn: fetchPreviewHtml,
    meta: { [SESSION_EXPIRY_META]: false },
  });

  useEffect(() => {
    mutate(doc);
  }, [mutate, doc]);

  return (
    <ModalDialog title={preview.title} onClose={onClose} className="editor-dialog-preview">
      {data === undefined ? (
        <p className="editor-dialog-body" role="status">
          {isError ? preview.failed : preview.loading}
        </p>
      ) : (
        <iframe
          className="editor-preview-frame"
          title={preview.title}
          sandbox="allow-same-origin"
          srcDoc={previewDocument(title, data)}
        />
      )}
      <div className="editor-dialog-row">
        <button type="button" className="editor-dialog-secondary" onClick={onClose}>
          {preview.close}
        </button>
      </div>
    </ModalDialog>
  );
}
