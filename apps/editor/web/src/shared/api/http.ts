import { HTTP_UNAUTHORIZED } from "./constants";
import { ApiError, UnauthorizedError } from "./errors";

/**
 * 같은 출처 API 요청 — 401은 `UnauthorizedError`, 그 밖의 실패는 `ApiError`로 던진다(design.md 1).
 * 화면의 쿼리 · mutation은 모두 이것을 거쳐야 401이 세션 만료로 이어진다.
 */
export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (response.ok) return response;
  const userMessage = await messageOf(response);
  if (response.status === HTTP_UNAUTHORIZED) throw new UnauthorizedError(userMessage);
  throw new ApiError(response.status, userMessage);
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
