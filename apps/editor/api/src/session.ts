/**
 * 로그인 세션(plan 3-5 · D8) — HMAC 서명 쿠키라 서버에 세션을 저장하지 않는다. 서명은 Hono 내장
 * `hono/cookie`(HMAC-SHA256)가 하고, 쿠키 값 `<accountId>.<만료 epoch 초>` 안의 만료를 서버가 따로 본다
 * — `Max-Age`는 브라우저가 지키는 것이라 복사된 쿠키에는 효력이 없다.
 */
import { setTimeout as sleep } from "node:timers/promises";
import type { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AccountStore } from "./accounts";
import {
  BODY_NOT_JSON_MESSAGE,
  LOGIN_BODY_MESSAGE,
  LOGIN_FAILED_MESSAGE,
  UNAUTHORIZED_MESSAGE,
} from "./messages";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password";

export interface SessionOptions {
  accounts: AccountStore;
  /** HMAC 키 — 32바이트 이상. 바꾸면 모든 세션이 끊긴다 */
  sessionSecret: string;
  /** 세션 수명(초). 기본 7일 */
  sessionTtlSeconds?: number;
  /** 로그인 실패 응답 전 고정 지연(ms). 기본 1초, 테스트는 0 */
  loginFailureDelayMs?: number;
  /** 현재 시각(epoch ms) — 만료 판정용, 테스트가 주입한다 */
  now?: () => number;
}

const SESSION_COOKIE = "session";
const SESSION_PATH = "/api/session";
const MIN_SECRET_BYTES = 32;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_FAILURE_DELAY_MS = 1000;
const MS_PER_SECOND = 1000;

/** `hono/cookie`는 옵션 타입을 따로 내보내지 않는다(패키지 exports에 utils 경로 없음) */
type CookieOptions = NonNullable<Parameters<typeof setSignedCookie>[4]>;

const COOKIE_ATTRIBUTES: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
  path: "/",
};

function readCredentials(body: unknown): { email: string; password: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") return null;
  return { email, password };
}

/** 쿠키 값에서 만료 시각을 꺼낸다. accountId에 점이 있어도 되도록 마지막 점으로 자른다 */
function expiresAtOf(value: string): number | null {
  const expiresAt = Number(value.slice(value.lastIndexOf(".") + 1));
  return Number.isInteger(expiresAt) ? expiresAt : null;
}

/**
 * `POST/DELETE /api/session`을 달고, 그 밖의 `/api/*` 앞에 세션 검사를 건다.
 * 글 라우트보다 먼저 불러야 미들웨어가 앞선다.
 */
export function registerSession(app: Hono, options: SessionOptions): void {
  const {
    accounts,
    sessionSecret,
    sessionTtlSeconds = DEFAULT_TTL_SECONDS,
    loginFailureDelayMs = DEFAULT_FAILURE_DELAY_MS,
    now = Date.now,
  } = options;
  if (Buffer.byteLength(sessionSecret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(`sessionSecret은 ${MIN_SECRET_BYTES}바이트 이상이어야 한다`);
  }
  const nowSeconds = () => Math.floor(now() / MS_PER_SECOND);

  app.use("/api/*", async (c, next) => {
    if (c.req.path === SESSION_PATH) return next();
    const value = await getSignedCookie(c, sessionSecret, SESSION_COOKIE);
    const expiresAt = typeof value === "string" ? expiresAtOf(value) : null;
    if (expiresAt === null || expiresAt <= nowSeconds()) {
      return c.json({ message: UNAUTHORIZED_MESSAGE }, 401);
    }
    return next();
  });

  app.post(SESSION_PATH, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: BODY_NOT_JSON_MESSAGE }, 400);
    }
    const credentials = readCredentials(body);
    if (credentials === null) return c.json({ message: LOGIN_BODY_MESSAGE }, 400);

    const account = await accounts.findByEmail(credentials.email);
    // 없는 계정도 scrypt를 한 번 돌린다 — 응답 시간으로 계정 유무가 드러나지 않게(D8)
    const matched = await verifyPassword(
      credentials.password,
      account?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (account === null || !matched) {
      await sleep(loginFailureDelayMs);
      return c.json({ message: LOGIN_FAILED_MESSAGE }, 401);
    }

    const expiresAt = nowSeconds() + sessionTtlSeconds;
    await setSignedCookie(c, SESSION_COOKIE, `${account.id}.${expiresAt}`, sessionSecret, {
      ...COOKIE_ATTRIBUTES,
      maxAge: sessionTtlSeconds,
    });
    return c.body(null, 204);
  });

  // 멱등 — 세션이 없거나 만료돼도 204다(화면이 만료된 세션에서 로그아웃을 눌러도 오류가 아니다)
  app.delete(SESSION_PATH, (c) => {
    deleteCookie(c, SESSION_COOKIE, COOKIE_ATTRIBUTES);
    return c.body(null, 204);
  });
}
