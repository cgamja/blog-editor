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
/**
 * 등록(`/register`)은 인증 없이 열려 있다 — 누가 계속 등록해도 저장소가 끝없이 늘지 않게 상한을 둔다.
 * 계정 1개 본인용이라 claude.ai · Claude Code 연결 몇 번이면 충분하다.
 */
export const DEFAULT_MAX_CLIENTS = 100;
/**
 * 막 등록한 클라이언트는 사람이 로그인 · 동의하는 동안 토큰이 없다 — 그 사이 등록 폭주에 밀려나지 않게
 * 이만큼은 밀어내지 않는다(code 수명 5분의 두 배).
 */
export const UNCONNECTED_CLIENT_GRACE_SECONDS = 10 * 60;
