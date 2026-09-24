import { HTTP_UNAUTHORIZED } from "./constants";
import { ApiError, UnauthorizedError } from "./errors";

/**
 * 같은 출처 API 요청 — 401은 `UnauthorizedError`, 그 밖의 실패는 `ApiError`로 던진다(design.md 1).
 * 화면의 쿼리 · mutation은 모두 이것을 거쳐야 401이 세션 만료로 이어진다.
 */
export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (response.ok) return response;
  const { message, reason } = await failureOf(response);
  if (response.status === HTTP_UNAUTHORIZED) throw new UnauthorizedError(message);
  throw new ApiError(response.status, message, reason);
}

const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);

/** 실패 본문의 `message`(사용자 문장) · `reason`(같은 상태 코드를 나누는 코드) */
async function failureOf(
  response: Response,
): Promise<{ message: string | null; reason: string | null }> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const { message, reason } = body as { message?: unknown; reason?: unknown };
      return { message: stringOrNull(message), reason: stringOrNull(reason) };
    }
  } catch {
    // 본문이 JSON이 아니면 API 문장이 없는 것이다
  }
  return { message: null, reason: null };
}
