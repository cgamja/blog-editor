import type { PostFile } from "@blog-editor/content-schema";
import { renderPreviewBody } from "../post-preview";

/**
 * 화면 글꼴 — web `shared/web-fonts.ts`의 `WEB_FONTS_STYLESHEET`와 같은 주소(api는 web을 import할 수 없다, adr-009).
 * 이 세 글꼴이 아래 `--font-*` 토큰의 이름이다.
 */
export const PREVIEW_WEB_FONTS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=Jua&family=Gaegu:wght@400;700&display=swap";

/**
 * post.css가 이름으로만 참조하는 사이트 토큰(content-render post.css 머리 주석) — 편집 화면 미리보기
 * (web `PREVIEW_TOKEN_NAMES`)와 같은 이름 · design-tokens `tokens.css`와 같은 값. api는 design-tokens를
 * import할 수 없어(adr-009 허용 엣지) 값을 옮겨 둔다 — 어긋나면 preview-page.test.ts가 잡는다.
 */
export const PREVIEW_SITE_TOKENS: Record<string, string> = {
  paper: "#fbf6ef",
  ink: "#3a2b26",
  "ink-soft": "#7b6b64",
  line: "#e4d9cf",
  "surface-2": "#fbf3ee",
  "brand-ink": "#b0552f",
  brand: "var(--brand-ink)",
  "brand-soft": "#ffede6",
  "accent-ink": "#2a4f41",
  "accent-soft": "#eaf5ee",
  "danger-ink": "#a3341f",
  postit: "#fff1cc",
  "font-sans": '"IBM Plex Sans KR", sans-serif',
  "font-display": '"Jua", sans-serif',
  "font-hand": '"Gaegu", sans-serif',
  "article-width": "47.5rem",
};

/**
 * 렌더러 밖의 틀 — 사이트 글 페이지처럼 본문 폭을 가운데로 모으고 종이 배경을 깐다. 글 제목은 사이트가 메타로 그리므로
 * 편집 화면 미리보기처럼 제목 글꼴만 맞춘다. 좌우 여백은 모바일 폭(390)에서도 글이 가장자리에 붙지 않을 만큼만.
 */
const FRAME_RULE =
  "body{margin:0;background:var(--paper)}" +
  "article{box-sizing:border-box;max-width:var(--article-width);margin:0 auto;padding:40px 20px}" +
  "article>h1{font-family:var(--font-display);font-weight:400;color:var(--ink)}";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.codePointAt(0) ?? 0};`);

function tokenRule(): string {
  const declarations = Object.entries(PREVIEW_SITE_TOKENS).map(
    ([name, value]) => `--${name}:${value}`,
  );
  return `:root{${declarations.join(";")}}`;
}

/**
 * 공개 페이지와 같은 문서 — 공개 렌더러 HTML(편집 화면 미리보기 `POST /api/preview`와 같은 함수) · 공개 post.css ·
 * 화면 글꼴. web `preview-document.ts`와 같은 모양이다.
 */
export function previewPageHtml(
  file: PostFile,
  options: { imageBaseUrl: string; postCss: string },
): string {
  const body = renderPreviewBody(file.doc, options.imageBaseUrl);
  const fontsLink = `<link rel="stylesheet" href="${PREVIEW_WEB_FONTS_STYLESHEET.replaceAll("&", "&amp;")}">`;
  return (
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">${fontsLink}` +
    `<style>${tokenRule()}${FRAME_RULE}</style><style>${options.postCss}</style></head>` +
    `<body><article><h1>${escapeHtml(file.meta.title)}</h1>${body}</article></body></html>`
  );
}
