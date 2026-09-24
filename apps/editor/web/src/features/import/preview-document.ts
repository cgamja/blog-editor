import tokensCss from "@blog-editor/design-tokens/tokens.css?raw";
import { WEB_FONTS_LINK } from "../../shared/web-fonts";
import { POST_CSS_PATH } from "./constants";

/**
 * 공개 렌더러 HTML을 본문 CSS · 화면 글꼴과 함께 싣는 미리보기 문서 — 공개 페이지와 같은 모양이고, 렌더 결과가
 * 에디터 화면 스타일과 섞이지 않는다. post.css는 색 · 글꼴을 사이트 토큰 이름으로만 참조하므로(content-render post.css 머리)
 * 같은 이름의 에디터 토큰을 함께 싣는다. srcdoc 문서는 부모 주소로 상대 경로를 푼다.
 */
export function previewDocument(html: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">${WEB_FONTS_LINK}<style>${tokensCss}body{margin:0;padding:var(--space-16);background:var(--surface)}</style><link rel="stylesheet" href="${POST_CSS_PATH}"></head><body>${html}</body></html>`;
}
