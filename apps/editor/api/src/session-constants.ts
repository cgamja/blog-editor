/**
 * 세션 쿠키 이름 · 속성(adr-026) — 로그인 · 세션 확인 · 로그아웃이 모드별로 같은 값을 본다.
 */
import type { CookieOptions, SessionCookieMode } from "./session-types";

/**
 * `__Host-` 접두사 — 브라우저는 Secure · Path=/ · Domain 없음일 때만 이 쿠키를 받는다. 상위 도메인
 * (simsimeestudio.com)이 심은 같은 이름 쿠키가 세션 쿠키를 가리지 못한다.
 */
export const COOKIE_PREFIX = "host";
/** Hono `prefix` 옵션이 쿠키 이름 앞에 붙이는 문자열 */
export const COOKIE_NAME_PREFIX_OF = { host: "__Host-" } as const;

/** 모드별 쿠키 속성 — `prefix`는 쓰기와 읽기(getSignedCookie)가 같이 쓴다 */
export const SESSION_COOKIE_OF: Record<SessionCookieMode, CookieOptions> = {
  secure: { prefix: COOKIE_PREFIX, httpOnly: true, secure: true, sameSite: "Strict", path: "/" },
  "loopback-http": { httpOnly: true, sameSite: "Strict", path: "/" },
};
