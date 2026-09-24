/** 로그인 여부 — `error`는 세션 확인 응답이 로그인 여부를 말해 주지 않을 때(403 · 5xx) */
export type SessionState = "authenticated" | "anonymous" | "error";
