import { WEB_FONTS_LINK } from "../../shared/web-fonts";
import { POST_CSS_PATH } from "./constants";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.codePointAt(0) ?? 0};`);

/**
 * 공개 페이지와 같은 문서 — 서버의 공개 렌더러 HTML(`POST /api/preview`)과 공개 `post.css`, 그리고 화면 글꼴.
 * `tokenRule`은 post.css가 이름으로 참조하는 사이트 토큰을 옮긴 `:root` 규칙이다(PreviewDialog가 지금 값을 읽어 넘긴다).
 */
export function previewDocument(title: string, bodyHtml: string, tokenRule: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">${WEB_FONTS_LINK}<style>${tokenRule}</style><link rel="stylesheet" href="${POST_CSS_PATH}"></head><body><article><h1>${escapeHtml(title)}</h1>${bodyHtml}</article></body></html>`;
}
