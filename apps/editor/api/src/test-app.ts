/**
 * `/api/*`가 세션을 요구하므로(api-session spec) 2개 이상의 테스트 파일이 같이 쓰는 로그인 준비만 둔다
 * — 시나리오별 입력은 각 테스트 파일에 인라인한다(adr/0034 ③). index에서 export하지 않는다.
 */
import { createMemoryAccountStore } from "./memory-account-store";
import type { Hono } from "hono";
import { hashPassword } from "./password";

export const TEST_ACCOUNT = {
  email: "me@simsimeestudio.com",
  password: "test-password-long-random",
};

// 테스트 속도를 위해 낮은 N — 해시 문자열이 파라미터를 들고 다니므로 검증은 그대로 된다
const TEST_HASH_PARAMS = { N: 1024 };

export const testAuthOptions = {
  accounts: createMemoryAccountStore([
    {
      id: "account-1",
      email: TEST_ACCOUNT.email,
      passwordHash: await hashPassword(TEST_ACCOUNT.password, TEST_HASH_PARAMS),
      workspaceId: "default",
    },
  ]),
  sessionSecret: "test-session-secret-32-bytes-long!!",
  loginFailureDelayMs: 0,
};

export function loginRequest(app: Hono, email: string, password: string) {
  return app.request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function cookieOf(res: Response): string {
  const setCookie = res.headers.get("Set-Cookie");
  if (setCookie === null) throw new Error("Set-Cookie가 없다");
  return setCookie.split(";")[0] ?? "";
}

/** 시드 계정으로 한 번 로그인하고, 이후 모든 요청에 그 세션 쿠키를 붙인다 */
export function withSession(app: Hono) {
  let cookie: Promise<string> | undefined;
  return {
    async request(path: string, init: RequestInit = {}) {
      // app.request는 Response | Promise<Response> 타입이라 Promise.resolve로 한 번 감싼다
      cookie ??= Promise.resolve(loginRequest(app, TEST_ACCOUNT.email, TEST_ACCOUNT.password)).then(
        cookieOf,
      );
      const sessionCookie = await cookie;
      const headers = new Headers(init.headers);
      headers.set("Cookie", sessionCookie);
      return app.request(path, { ...init, headers });
    },
  };
}
