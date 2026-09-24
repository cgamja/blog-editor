/** 가져온 초안의 출처 — 에디터에서 사람이 만든 글(목록의 "AI가 올린 초안" 표시가 붙지 않는다) */
export const IMPORTED_SOURCE = "editor";

export const IMPORT_PREVIEW_PATH = "/api/import/preview";
export const POSTS_PATH = "/api/posts";
export const IMPORT_PREVIEW_QUERY_KEY = "import-preview";
export const MARKDOWN_FILE_ACCEPT = ".md,.markdown,text/markdown";
export const MARKDOWN_FILE_EXTENSIONS: readonly string[] = [".md", ".markdown"];
/** 서버 markdown 상한 — api `input-limits.ts` `MAX_MARKDOWN_LENGTH`와 같은 값(계약 400 문장에도 있다) */
export const MARKDOWN_MAX_LENGTH = 200_000;
/** UTF-8 한 글자 최대 4바이트 — 이보다 큰 파일은 글자 수 상한을 넘을 수밖에 없다 */
const MAX_BYTES_PER_CHAR = 4;
export const MARKDOWN_FILE_MAX_BYTES = MARKDOWN_MAX_LENGTH * MAX_BYTES_PER_CHAR;
/** 입력을 멈춘 뒤 미리보기를 부르기까지(ms) — 타자마다 변환하지 않는다 */
export const PREVIEW_DEBOUNCE_MS = 400;
/** 네트워크 · 5xx 재시도 횟수(TanStack Query 기본과 같다) */
export const PREVIEW_MAX_RETRIES = 3;
/** 글 날짜는 블로그 독자 기준(API mcp/route.ts와 같다) — en-CA 로캘이 YYYY-MM-DD로 쓴다 */
export const BLOG_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
/** 미리보기 iframe이 읽는 본문 CSS — 공개 페이지와 같은 파일 */
export const POST_CSS_PATH = "/public/post.css";
