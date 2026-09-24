/** 세션이 없거나 만료됨 — API `requireSession`이 돌려주는 코드 */
export const HTTP_UNAUTHORIZED = 401;

/** mutation `meta`에서 이 값이 `false`면 401이어도 세션을 로그인 필요로 바꾸지 않는다(그 화면이 스스로 알린다) */
export const SESSION_EXPIRY_META = "expiresSessionOnUnauthorized";
