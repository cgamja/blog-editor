/**
 * 로그인 세션(plan 3-5 · D8) — HMAC 서명 쿠키라 서버에 세션을 저장하지 않는다. 서명은 Hono 내장
 * `hono/cookie`(HMAC-SHA256)가 하고, 쿠키 값 `<accountId>.<만료 epoch 초>` 안의 만료를 서버가 따로 본다
 * — `Max-Age`는 브라우저가 지키는 것이라 복사된 쿠키에는 효력이 없다.
 */
import { setTimeout as sleep } from "node:timers/promises";
import type { Context, Hono, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { Account, AccountStore } from "./accounts";
import { createLoginLockout } from "./login-lockout";
import type { LoginLockout } from "./login-lockout";
import {
  BODY_NOT_JSON_MESSAGE,
  LOGIN_BODY_MESSAGE,
  LOGIN_FAILED_MESSAGE,
  UNAUTHORIZED_MESSAGE,
} from "./messages";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password";
import { COOKIE_NAME_PREFIX_OF, COOKIE_PREFIX, SESSION_COOKIE_OF } from "./session-constants";
import type { CookieOptions, SessionCookieMode } from "./session-types";

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
  /** 기본 `secure`. `loopback-http`는 로컬 진입점만 넘긴다(SessionCookieMode) */
  sessionCookie?: SessionCookieMode;
}

export interface SessionConfig {
  accounts: AccountStore;
  sessionSecret: string;
  sessionTtlSeconds: number;
  loginFailureDelayMs: number;
  nowSeconds: () => number;
  /** 쓰기 · 읽기 · 지우기가 같은 이름 · 속성을 쓰도록 모드에서 한 번 정한다 */
  cookie: CookieOptions;
  /** 앱 하나에 하나 — 재시작하면 초기화된다 */
  lockout: LoginLockout;
}

const SESSION_COOKIE = "session";
const SESSION_PATH = "/api/session";
const MIN_SECRET_BYTES = 32;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_FAILURE_DELAY_MS = 1000;
const MS_PER_SECOND = 1000;
/** 계정 id와 겹치지 않는 값 — 계정 id는 시드 · 저장소가 정하고 공백을 쓰지 않는다 */
const UNKNOWN_ACCOUNT_KEY = " unknown-account";

/** 배포(`secure` 모드)에서 브라우저에 적히는 쿠키 이름(계약 문서가 쓴다) */
export const SESSION_COOKIE_NAME = `${COOKIE_NAME_PREFIX_OF[COOKIE_PREFIX]}${SESSION_COOKIE}`;

function readCredentials(body: unknown): { username: string; password: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const { username, password } = body as Record<string, unknown>;
  if (typeof username !== "string" || typeof password !== "string") return null;
  return { username, password };
}

/** accountId에 점이 있어도 되도록 마지막 점으로 자른다 */
function expiresAtOf(value: string): number | null {
  const expiresAt = Number(value.slice(value.lastIndexOf(".") + 1));
  return Number.isInteger(expiresAt) ? expiresAt : null;
}

/** 설정 실수(짧은 비밀)는 요청이 아니라 앱을 만들 때 드러난다 */
export function resolveSessionConfig(options: SessionOptions): SessionConfig {
  const {
    accounts,
    sessionSecret,
    sessionTtlSeconds = DEFAULT_TTL_SECONDS,
    loginFailureDelayMs = DEFAULT_FAILURE_DELAY_MS,
    now = Date.now,
    sessionCookie = "secure",
  } = options;
  if (Buffer.byteLength(sessionSecret, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(`sessionSecret은 ${MIN_SECRET_BYTES}바이트 이상이어야 한다`);
  }
  const nowSeconds = () => Math.floor(now() / MS_PER_SECOND);
  return {
    accounts,
    sessionSecret,
    sessionTtlSeconds,
    loginFailureDelayMs,
    nowSeconds,
    cookie: SESSION_COOKIE_OF[sessionCookie],
    lockout: createLoginLockout(),
  };
}

/**
 * 로그인 · 로그아웃만 세션 없이 들어온다. 메서드까지 보는 이유: 나중에 `/api/session`에 붙는
 * 다른 메서드(세션 확인 GET 등)가 인증 없이 열리지 않게.
 */
const SESSION_FREE_METHODS: ReadonlySet<string> = new Set(["POST", "DELETE"]);

/** 서명 · 만료가 맞는 세션 쿠키의 계정 id. 없거나 위조 · 만료면 null */
export async function sessionAccountId(
  c: Context,
  { sessionSecret, nowSeconds, cookie }: SessionConfig,
): Promise<string | null> {
  const value = await getSignedCookie(c, sessionSecret, SESSION_COOKIE, cookie.prefix);
  if (typeof value !== "string") return null;
  const expiresAt = expiresAtOf(value);
  if (expiresAt === null || expiresAt <= nowSeconds()) return null;
  return value.slice(0, value.lastIndexOf("."));
}

/**
 * 아이디 · 비밀번호 확인 — `/api/session`과 OAuth `/authorize`가 같은 것을 쓴다. 실패하면 고정 지연 뒤 null.
 * 없는 계정도 scrypt를 한 번 돌린다 — 응답 시간으로 계정 유무가 드러나지 않게(D8). 잠긴 계정은 비밀번호가
 * 맞아도 실패다(login-lockout) — 잠긴 동안에도 scrypt와 지연을 똑같이 거쳐 응답으로 잠금 여부가 갈리지 않는다.
 */
export async function authenticate(
  { accounts, loginFailureDelayMs, lockout, nowSeconds }: SessionConfig,
  username: string,
  password: string,
): Promise<Account | null> {
  const account = await accounts.findByUsername(username);
  const matched = await verifyPassword(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);
  // 없는 아이디는 하나로 묶어 센다 — 잠금으로도 계정 유무가 드러나지 않게
  const key = account?.id ?? UNKNOWN_ACCOUNT_KEY;
  const now = nowSeconds();
  const locked = lockout.isLocked(key, now);
  if (account === null || !matched || locked) {
    // 잠긴 동안의 시도는 세지 않는다 — 잠금이 끝없이 늘어나지 않게
    if (!locked) lockout.recordFailure(key, now);
    await sleep(loginFailureDelayMs);
    return null;
  }
  lockout.recordSuccess(key);
  return account;
}

export function requireSession(config: SessionConfig): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.path === SESSION_PATH && SESSION_FREE_METHODS.has(c.req.method)) return next();
    if ((await sessionAccountId(c, config)) === null) {
      return c.json({ message: UNAUTHORIZED_MESSAGE }, 401);
    }
    return next();
  };
}

export function registerSessionRoutes(app: Hono, config: SessionConfig): void {
  const { sessionSecret, sessionTtlSeconds, nowSeconds, cookie } = config;

  app.post(SESSION_PATH, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: BODY_NOT_JSON_MESSAGE }, 400);
    }
    const credentials = readCredentials(body);
    if (credentials === null) return c.json({ message: LOGIN_BODY_MESSAGE }, 400);

    const account = await authenticate(config, credentials.username, credentials.password);
    if (account === null) return c.json({ message: LOGIN_FAILED_MESSAGE }, 401);

    const expiresAt = nowSeconds() + sessionTtlSeconds;
    await setSignedCookie(c, SESSION_COOKIE, `${account.id}.${expiresAt}`, sessionSecret, {
      ...cookie,
      maxAge: sessionTtlSeconds,
    });
    return c.body(null, 204);
  });

  // 세션 판정은 `/api/*` 미들웨어(requireSession)가 끝냈다 — 여기 오면 로그인됨이다
  app.get(SESSION_PATH, (c) => c.body(null, 204));

  // 멱등 — 세션이 없거나 만료돼도 204다(화면이 만료된 세션에서 로그아웃을 눌러도 오류가 아니다)
  app.delete(SESSION_PATH, (c) => {
    deleteCookie(c, SESSION_COOKIE, cookie);
    return c.body(null, 204);
  });
}
