import type { SessionState } from "./types";

const UNAUTHORIZED = 401;
const SUCCESS_MIN = 200;
const SUCCESS_MAX = 299;

/**
 * 세션 확인 요청의 상태 코드 → 로그인 여부(design.md 1). `/api/*`는 세션이 없으면 401을 준다.
 * 그 밖의 코드(403 · 404 · 5xx)는 로그인 여부를 말해 주지 않으므로 오류로 둔다 — 로그인 화면으로 보내지 않는다.
 */
export function sessionStateOf(status: number): SessionState {
  if (status === UNAUTHORIZED) return "anonymous";
  if (status >= SUCCESS_MIN && status <= SUCCESS_MAX) return "authenticated";
  return "error";
}
