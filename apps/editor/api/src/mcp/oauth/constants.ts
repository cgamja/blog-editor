/** 수명(초) — mcp-oauth design 4 */
export const CODE_TTL_SECONDS = 5 * 60;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
/** 등록 · 인가 · 토큰 요청은 작은 JSON · 폼이다 */
export const MAX_FORM_BYTES = 16 * 1024;
export const GRANT_TYPES = ["authorization_code", "refresh_token"] as const;
export const RESPONSE_TYPES = ["code"] as const;
/** 토큰 · 등록 · 인가 화면 응답은 어디에도 캐시되지 않는다(RFC 6749 5.1) */
export const NO_STORE_HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache" };
