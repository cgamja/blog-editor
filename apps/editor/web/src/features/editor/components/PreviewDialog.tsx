import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Doc } from "@blog-editor/content-schema";
import { SESSION_EXPIRY_META } from "../../../shared/api/constants";
import { fetchPreviewHtml } from "../api";
import { POST_CSS_PATH, PREVIEW_TOKEN_NAMES } from "../constants";
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
 * post.css는 사이트의 색 · 글꼴 토큰을 이름으로만 참조한다(content-render post.css 머리 주석). iframe은 이 앱의
 * `:root` 토큰을 물려받지 않아 지금 값을 옮겨 준다 — 값은 tokens.css가 정한 것 그대로다.
 */
function siteTokenRule(): string {
  const root = getComputedStyle(document.documentElement);
  const declarations = PREVIEW_TOKEN_NAMES.map(
    (name) => `--${name}:${root.getPropertyValue(`--${name}`)}`,
  );
  // 글 제목은 렌더러 밖(사이트가 메타로 그린다) — 사이트 제목 글꼴만 맞춘다
  return `:root{${declarations.join(";")}}article>h1{font-family:var(--font-display);font-weight:400}`;
}

/**
 * 공개 페이지와 같은 문서 — 서버의 공개 렌더러 HTML(`POST /api/preview`)과 공개 `post.css`.
 * `sandbox`에 스크립트 허용이 없어 렌더러 밖의 것이 실행될 길이 없다. 같은 출처는 올린 이미지(CORP same-site) 때문이다.
 */
function previewDocument(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${siteTokenRule()}</style><link rel="stylesheet" href="${POST_CSS_PATH}"></head><body><article><h1>${escapeHtml(title)}</h1>${bodyHtml}</article></body></html>`;
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
