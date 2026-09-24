/**
 * 로그인 잠금 카운터(api-session · D8 재검토 조건 · adr-018). 요청마다 두는 고정 지연은 병렬 요청을 막지 못한다
 * — 짧은 비밀번호로 터널을 열면 무차별 대입의 상한은 이 카운터다. 메모리라 재시작하면 초기화된다(영속은 M4, #33).
 */
export const MAX_CONSECUTIVE_FAILURES = 5;
export const LOCKOUT_SECONDS = 15 * 60;

export interface LoginLockout {
  isLocked(key: string, nowSeconds: number): boolean;
  recordFailure(key: string, nowSeconds: number): void;
  recordSuccess(key: string): void;
}

interface FailureState {
  failures: number;
  lockedUntil: number;
}

/** 키는 계정 id와 "없는 아이디" 묶음 하나뿐이라 맵이 끝없이 늘지 않는다 */
export function createLoginLockout(): LoginLockout {
  const states = new Map<string, FailureState>();
  const current = (key: string, nowSeconds: number): FailureState => {
    const state = states.get(key);
    // 잠금이 풀리면 실패 수도 처음부터 센다
    if (state === undefined || (state.lockedUntil !== 0 && state.lockedUntil <= nowSeconds)) {
      return { failures: 0, lockedUntil: 0 };
    }
    return state;
  };
  return {
    isLocked(key, nowSeconds) {
      return current(key, nowSeconds).lockedUntil > nowSeconds;
    },
    recordFailure(key, nowSeconds) {
      const failures = current(key, nowSeconds).failures + 1;
      const lockedUntil = failures >= MAX_CONSECUTIVE_FAILURES ? nowSeconds + LOCKOUT_SECONDS : 0;
      states.set(key, { failures, lockedUntil });
    },
    recordSuccess(key) {
      states.delete(key);
    },
  };
}
