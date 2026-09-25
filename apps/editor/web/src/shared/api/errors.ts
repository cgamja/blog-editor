import { HTTP_CONFLICT, HTTP_UNAUTHORIZED } from "./constants";

/** API가 거절한 요청 — `userMessage`는 API가 본문 `message`로 보낸 사용자용 문장(없으면 null). */
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

/**
 * 세션이 없거나 만료됐다(401) — QueryClient가 세션을 로그인 필요로 바꿔 가드가 로그인 화면으로 보낸다.
 * 화면이 렌더 중 던진 401은 가드 자리 경계(`SessionErrorBoundary`)가 로그인 화면으로 보낸다.
 * 재시도해도 결과가 같아서 다시 묻지 않는다. 로그인 실패 문장을 보이려고 API 문장은 그대로 싣는다.
 */
export class UnauthorizedError extends ApiError {
  constructor(userMessage: string | null = null) {
    super(HTTP_UNAUTHORIZED, userMessage);
    this.name = "UnauthorizedError";
  }
}

/**
 * 조건부 저장이 어긋났다(409) — 고치기면 다른 곳에서 먼저 저장했고, 새 글이면 그 주소에 글이 있다.
 * 화면은 `instanceof ConflictError`로 가르고, 더 나눌 때는 `body`(API가 보낸 JSON 본문, 없으면 null)를 본다
 * (.claude/rules/state.md).
 */
export class ConflictError extends ApiError {
  readonly body: unknown;

  constructor(userMessage: string | null = null, body: unknown = null) {
    super(HTTP_CONFLICT, userMessage);
    this.name = "ConflictError";
    this.body = body;
  }
}
