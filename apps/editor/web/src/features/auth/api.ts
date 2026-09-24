import { apiRequest } from "../../shared/api/http";
import { SESSION_PATH } from "./constants";
import { sessionStateOf } from "./session";
import type { SessionState } from "./types";

/** 세션 확인 — 401도 답이라(로그인 필요) 던지지 않고 상태 코드를 그대로 판정한다. */
export async function probeSession(): Promise<SessionState> {
  const response = await fetch(SESSION_PATH, { method: "GET" });
  return sessionStateOf(response.status);
}

export async function login(username: string, password: string): Promise<void> {
  await apiRequest(SESSION_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

/** 멱등 — 세션이 이미 없어도 204다(api-session) */
export async function logout(): Promise<void> {
  await apiRequest(SESSION_PATH, { method: "DELETE" });
}
