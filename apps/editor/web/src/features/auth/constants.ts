export const SESSION_QUERY_KEY = ["session"] as const;

/**
 * 세션 확인에 쓰는 요청 — 지금 API에는 확인 전용 엔드포인트가 없어 가장 가벼운 읽기의 상태 코드를 본다(design.md 1).
 * `/api` 계약(#94)이 `GET /api/session`을 만들면 이 값만 바꾼다.
 */
export const SESSION_PROBE_PATH = "/api/posts";

/** 로그인(POST) */
export const SESSION_PATH = "/api/session";
