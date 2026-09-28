import type { SupabaseClient } from "@supabase/supabase-js";
import { LOCKOUT_SECONDS, MAX_CONSECUTIVE_FAILURES, MAX_LOCKOUT_SECONDS } from "../login-lockout";
import type { LoginLockout } from "../login-lockout";

const LOGIN_LOCKOUTS = "login_lockouts";

/**
 * 배포용 로그인 잠금(ADR-045) — `login_lockouts` 표라 함수가 새로 켜져도 남는다. 시도 기록은 DB 함수
 * `record_login_failure` 한 문장이라 세기와 잠금 확인이 행 잠금 아래 같이 일어난다(병렬 요청이 잠금을 건너뛰지 못한다). 누적 규칙(lockoutSecondsFor)은 그 함수가
 * 같은 상수로 계산한다 — 상수는 여기서 넘겨 한 곳(login-lockout.ts)에 둔다.
 */
export function createSupabaseLoginLockout(options: { client: SupabaseClient }): LoginLockout {
  const { client } = options;

  return {
    async isLocked(key, nowSeconds) {
      const { data } = await client
        .from(LOGIN_LOCKOUTS)
        .select("locked_until")
        .eq("key", key)
        .maybeSingle()
        .throwOnError();
      const row = data as { locked_until: number } | null;
      return row !== null && row.locked_until > nowSeconds;
    },
    async recordFailure(key, nowSeconds) {
      const { data } = await client
        .rpc("record_login_failure", {
          p_key: key,
          p_now: nowSeconds,
          p_max_failures: MAX_CONSECUTIVE_FAILURES,
          p_base_seconds: LOCKOUT_SECONDS,
          p_max_seconds: MAX_LOCKOUT_SECONDS,
        })
        .throwOnError();
      return data === true;
    },
    async recordSuccess(key) {
      await client.from(LOGIN_LOCKOUTS).delete().eq("key", key).throwOnError();
    },
  };
}
