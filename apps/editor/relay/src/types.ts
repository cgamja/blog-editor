/** Cloudflare 요청량 제한 바인딩의 모양 — 분당 한도는 wrangler.jsonc가 정한다 */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RelayEnv {
  /** Supabase 함수 주소(…/functions/v1/editor) — 경로 · 쿼리를 이 뒤에 붙인다 */
  API_ORIGIN: string;
  RELAY_SECRET: string;
  LOGIN_RATE_LIMIT: RateLimiter;
}
