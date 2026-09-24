import type { setSignedCookie } from "hono/cookie";

/**
 * 세션 쿠키 모양. `secure`(기본 · 배포)는 `__Host-` + Secure다. `loopback-http`는 로컬 진입점(serve.ts —
 * 127.0.0.1에만 묶인 http) 전용이다 — Safari · WebKit은 http 루프백을 안전한 출처로 보지 않아 Secure 쿠키를
 * 저장하지 않으므로(#118) 접두사와 Secure만 뺀다. HttpOnly · SameSite=Strict · Path=/는 같다(adr-026).
 */
export type SessionCookieMode = "secure" | "loopback-http";

/** `hono/cookie`는 옵션 타입을 따로 내보내지 않는다(패키지 exports에 utils 경로 없음) */
export type CookieOptions = NonNullable<Parameters<typeof setSignedCookie>[4]>;
