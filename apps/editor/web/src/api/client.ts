import { sessionStateOf } from "../auth/session";
import type { SessionState } from "../auth/session";

/**
 * 세션 확인에 쓰는 요청 — 지금 API에는 확인 전용 엔드포인트가 없어 가장 가벼운 읽기의 상태 코드를 본다(design.md 1).
 * `/api` 계약(#94)이 `GET /api/session`을 만들면 이 값만 바꾼다.
 */
export const SESSION_PROBE_PATH = "/api/posts";
const SESSION_PATH = "/api/session";

/** 세션이 없거나 만료됐다 — 화면은 로그인으로 보낸다. 재시도해도 결과가 같아서 쿼리는 다시 묻지 않는다. */
export class UnauthorizedError extends Error {
  constructor() {
    super("세션이 없어요");
    this.name = "UnauthorizedError";
  }
}

/** API가 거절한 요청 — `message`는 API가 보낸 사용자용 문장(없으면 null). */
export class ApiError extends Error {
  readonly status: number;
  readonly userMessage: string | null;

  constructor(status: number, userMessage: string | null) {
    super(`API ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.userMessage = userMessage;
  }
}

export async function probeSession(): Promise<SessionState> {
  const response = await fetch(SESSION_PROBE_PATH, { method: "GET" });
  return sessionStateOf(response.status);
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(SESSION_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new ApiError(response.status, await messageOf(response));
}

export async function logout(): Promise<void> {
  await fetch(SESSION_PATH, { method: "DELETE" });
}

async function messageOf(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      const { message } = body as { message: unknown };
      return typeof message === "string" ? message : null;
    }
  } catch {
    // 본문이 JSON이 아니면 API 문장이 없는 것이다
  }
  return null;
}
