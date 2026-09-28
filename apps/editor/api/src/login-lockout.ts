/**
 * 로그인 잠금 카운터(api-session · D8 재검토 조건 · adr-018 · ADR-045). 요청마다 두는 고정 지연은 병렬 요청을
 * 막지 못한다 — 짧은 비밀번호로 공개하면 무차별 대입의 상한은 이 카운터다. 잠길 때마다 시간이 두 배로 늘어
 * (상한 24시간) 꾸준히 시도하는 쪽도 느려진다. 로컬은 메모리(재시작하면 초기화), 배포는 Supabase
 * `login_lockouts` 표(supabase/login-lockout.ts)라 함수가 새로 켜져도 남는다.
 */
export const MAX_CONSECUTIVE_FAILURES = 5;
/** 첫 잠금 시간 — 잠길 때마다 두 배 */
export const LOCKOUT_SECONDS = 15 * 60;
/** 잠금 시간 상한 — 아이디를 아는 사람이 주인을 잠글 수 있는 최대 시간이기도 하다(ADR-045 트레이드오프) */
export const MAX_LOCKOUT_SECONDS = 24 * 60 * 60;

export interface LoginLockout {
  /**
   * 지금 잠겨 있는가 — 계약 테스트 · 점검용. 로그인 경로는 이것으로 따로 확인하지 않고 `recordFailure`의 결과로
   * 판정한다(따로 확인하면 병렬 요청이 확인과 기록 사이로 빠져나간다)
   */
  isLocked(key: string, nowSeconds: number): Promise<boolean>;
  /**
   * 시도 하나를 실패로 센다 — 로그인은 비밀번호를 보기 **전에** 부르고 맞으면 `recordSuccess`로 지운다. 잠겨 있으면
   * 세지 않고(잠금 끝이 늘지 않는다) false. 세기와 잠금 확인이 한 번에 일어나 병렬 요청도 잠금 한 번에
   * `MAX_CONSECUTIVE_FAILURES`번까지만 true를 받는다 — 따로 확인하면 잠기기 전에 들어온 요청이 전부 비밀번호를 본다
   */
  recordFailure(key: string, nowSeconds: number): Promise<boolean>;
  /** 실패 수 · 잠긴 횟수 모두 처음으로 */
  recordSuccess(key: string): Promise<void>;
}

/** `lockCount`번째 잠금의 길이(초) — 15분 × 2^(횟수-1), 상한 24시간. Supabase 구현은 같은 규칙을 DB 함수가 계산한다 */
export function lockoutSecondsFor(lockCount: number): number {
  return Math.min(LOCKOUT_SECONDS * 2 ** (lockCount - 1), MAX_LOCKOUT_SECONDS);
}

interface FailureState {
  failures: number;
  lockedUntil: number;
  lockCount: number;
}

/** 키는 계정 id와 "없는 아이디" 묶음 하나뿐이라 맵이 끝없이 늘지 않는다 */
export function createLoginLockout(): LoginLockout {
  const states = new Map<string, FailureState>();
  const current = (key: string, nowSeconds: number): FailureState => {
    const state = states.get(key) ?? { failures: 0, lockedUntil: 0, lockCount: 0 };
    // 잠금이 풀리면 실패 수만 처음부터 센다 — 잠긴 횟수는 성공할 때까지 남는다
    if (state.lockedUntil !== 0 && state.lockedUntil <= nowSeconds) {
      return { failures: 0, lockedUntil: 0, lockCount: state.lockCount };
    }
    return state;
  };
  return {
    async isLocked(key, nowSeconds) {
      return current(key, nowSeconds).lockedUntil > nowSeconds;
    },
    async recordFailure(key, nowSeconds) {
      const state = current(key, nowSeconds);
      if (state.lockedUntil > nowSeconds) return false;
      const failures = state.failures + 1;
      if (failures < MAX_CONSECUTIVE_FAILURES) {
        states.set(key, { ...state, failures });
        return true;
      }
      const lockCount = state.lockCount + 1;
      states.set(key, {
        failures,
        lockedUntil: nowSeconds + lockoutSecondsFor(lockCount),
        lockCount,
      });
      return true;
    },
    async recordSuccess(key) {
      states.delete(key);
    },
  };
}
