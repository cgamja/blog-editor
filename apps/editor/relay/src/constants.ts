/** 함수가 "중계를 거친 요청"임을 확인하는 헤더 — 들어온 값은 버리고 Worker 시크릿으로 갈아 끼운다(보호 대상) */
export const RELAY_SECRET_HEADER = "X-Relay-Secret";
/** 로그인 두 경로의 IP당 분당 한도 — 실제 적용은 wrangler.jsonc ratelimits(같은 값, ADR-047) */
export const LOGIN_RATE_LIMIT_PER_MINUTE = 10;
