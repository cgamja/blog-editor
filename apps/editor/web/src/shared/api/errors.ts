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

const UNAUTHORIZED = 401;

/**
 * 세션이 없거나 만료됐다(401) — QueryClient가 세션을 로그인 필요로 바꿔 가드가 로그인 화면으로 보낸다.
 * 재시도해도 결과가 같아서 다시 묻지 않는다. 로그인 실패 문장을 보이려고 API 문장은 그대로 싣는다.
 */
export class UnauthorizedError extends ApiError {
  constructor(userMessage: string | null = null) {
    super(UNAUTHORIZED, userMessage);
    this.name = "UnauthorizedError";
  }
}
