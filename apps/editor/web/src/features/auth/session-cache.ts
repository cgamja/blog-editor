import type { QueryClient } from "@tanstack/react-query";
import { SESSION_QUERY_KEY } from "./constants";
import type { SessionState } from "./types";

/**
 * 로그인 성공 → 세션 캐시를 바로 로그인됨으로(design.md 3). 로그인 화면에서는 세션 쿼리를 보는 곳이 없어
 * `invalidateQueries`는 표시만 하고 다시 묻지 않는다 — 그러면 가드가 남은 'anonymous'를 읽고 /login으로 되돌린다.
 */
export function markSignedIn(client: QueryClient): void {
  client.setQueryData<SessionState>(SESSION_QUERY_KEY, "authenticated");
}

/** 로그아웃 → 앞 계정의 캐시(글 목록 등)를 모두 버리고 세션을 로그인 필요로 */
export function markSignedOut(client: QueryClient): void {
  client.clear();
  client.setQueryData<SessionState>(SESSION_QUERY_KEY, "anonymous");
}

/** 어느 요청이든 401 → 세션을 로그인 필요로. 가드가 지금 경로를 `next`로 기억해 로그인 화면으로 보낸다. */
export function markSessionExpired(client: QueryClient): void {
  client.setQueryData<SessionState>(SESSION_QUERY_KEY, "anonymous");
}
