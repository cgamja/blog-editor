/** 한 편의 글로 충분한 길이(문자 수) — MCP 도구와 가져오기 미리보기가 변환기에 넘기는 양을 같은 값으로 묶는다 */
export const MAX_MARKDOWN_LENGTH = 200_000;

/** 글쓰기 가이드 상한(문자 수) — 형식 가이드와 합쳐 MCP 응답 한 번에 실릴 양(design.md 1) */
export const MAX_GUIDE_LENGTH = 20_000;

/** UTF-8 한 글자는 최대 4바이트 — 문자 수 상한을 요청 본문 바이트 상한으로 바꿀 때 쓴다(JSON 봉투 여유 포함) */
export const MAX_BYTES_PER_CHAR = 4;
export const MAX_IMPORT_BODY_BYTES = MAX_MARKDOWN_LENGTH * MAX_BYTES_PER_CHAR;
export const MAX_SETTINGS_BODY_BYTES = MAX_GUIDE_LENGTH * MAX_BYTES_PER_CHAR;

/** 미리보기 본문 상한(바이트) — 한 편의 글 문서로 충분한 양. 넘으면 읽지 않고 413 */
export const MAX_PREVIEW_BODY_BYTES = 1024 * 1024;
