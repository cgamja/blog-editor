/**
 * 화면 글꼴 스타일시트 — Google Fonts 한 장(tokens.css의 `--font-sans` · `--font-display` · `--font-hand`).
 * index.html에는 vite.config.ts 플러그인이 이 주소로 링크를 넣고, 미리보기 iframe은 `WEB_FONTS_LINK`를 싣는다 — 원천은 여기 하나.
 */
export const WEB_FONTS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=Jua&family=Gaegu:wght@400;700&display=swap";

/**
 * srcdoc 미리보기 문서의 `<head>`에 넣는 링크. `FontFaceSet`은 문서마다 따로라 iframe은 부모가 받은 글꼴을 쓰지 못한다(#112).
 * 주소의 `&`는 HTML 속성 값이라 문자 참조로 적는다.
 */
export const WEB_FONTS_LINK = `<link rel="stylesheet" href="${WEB_FONTS_STYLESHEET.replaceAll("&", "&amp;")}">`;
