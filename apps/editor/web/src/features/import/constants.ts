/** 가져온 초안의 출처 — 에디터에서 사람이 만든 글(목록의 "AI가 올린 초안" 표시가 붙지 않는다) */
export const IMPORTED_SOURCE = "editor";

export const IMPORT_PREVIEW_PATH = "/api/import/preview";
export const POSTS_PATH = "/api/posts";
export const IMPORT_PREVIEW_QUERY_KEY = "import-preview";
export const MARKDOWN_FILE_ACCEPT = ".md,.markdown,text/markdown";
/** 입력을 멈춘 뒤 미리보기를 부르기까지(ms) — 타자마다 변환하지 않는다 */
export const PREVIEW_DEBOUNCE_MS = 400;
/** 글 날짜는 블로그 독자 기준(API mcp/route.ts와 같다) — en-CA 로캘이 YYYY-MM-DD로 쓴다 */
export const BLOG_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
/** 미리보기 iframe이 읽는 본문 CSS — 공개 페이지와 같은 파일 */
export const POST_CSS_PATH = "/public/post.css";
