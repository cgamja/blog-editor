/** 세션이 없거나 만료됨 — API `requireSession`이 돌려주는 코드 */
export const HTTP_UNAUTHORIZED = 401;

/** 조건부 저장이 어긋남 — 새 글(`If-None-Match: *`)이면 그 주소에 글이 이미 있다 */
export const HTTP_CONFLICT = 409;

/** 서버가 거절한 입력 — 스키마 이슈 문장이 붙는다 */
export const HTTP_BAD_REQUEST = 400;

/** 없는 글 */
export const HTTP_NOT_FOUND = 404;

/** 이 코드부터 서버 쪽 실패 — 다시 물으면 나을 수 있다 */
export const HTTP_SERVER_ERROR = 500;

/** mutation `meta`에서 이 값이 `false`면 401이어도 세션을 로그인 필요로 바꾸지 않는다(그 화면이 스스로 알린다) */
export const SESSION_EXPIRY_META = "expiresSessionOnUnauthorized";
