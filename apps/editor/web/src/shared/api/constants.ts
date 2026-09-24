/** 세션이 없거나 만료됨 — API `requireSession`이 돌려주는 코드 */
export const HTTP_UNAUTHORIZED = 401;

/** 조건부 저장이 어긋남 — 새 글(`If-None-Match: *`)이면 그 주소에 글이 이미 있다 */
export const HTTP_CONFLICT = 409;
