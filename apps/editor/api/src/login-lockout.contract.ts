import { randomUUID } from "node:crypto";
import { LOCKOUT_SECONDS, MAX_CONSECUTIVE_FAILURES } from "./login-lockout";
import type { LoginLockout } from "./login-lockout";

const T0 = Date.UTC(2026, 8, 28) / 1000;
const DAY = 24 * 60 * 60;

async function failTimes(lockout: LoginLockout, key: string, nowSeconds: number, times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await lockout.recordFailure(key, nowSeconds);
  }
}

/**
 * 로그인 잠금 계약 스위트(api-session · ADR-045) — 메모리 · Supabase 구현이 같은 것을 통과한다
 * (post-store.contract.ts와 같은 관례). 구현별 테스트 파일이 잠금 만드는 법만 넘긴다. 공유 DB 표라서
 * 키는 테스트마다 새로 받는다 — Supabase 층은 `newKey`로 쓴 키를 기록해 두었다가 지운다.
 */
export function describeLoginLockoutContract(
  name: string,
  createLockout: () => Promise<LoginLockout>,
  newKey: () => string = randomUUID,
) {
  describe(`${name} — 로그인 잠금 계약 (보호 대상 — 고쳐서 통과시키지 않는다)`, () => {
    it("WHEN 같은 키로 4번 실패하면 잠기지 않고 5번째 실패하면 THEN 잠긴다", async () => {
      const lockout = await createLockout();
      const key = newKey();

      await failTimes(lockout, key, T0, MAX_CONSECUTIVE_FAILURES - 1);
      const beforeFifth = await lockout.isLocked(key, T0);
      await lockout.recordFailure(key, T0);

      expect(beforeFifth).toBe(false);
      expect(await lockout.isLocked(key, T0)).toBe(true);
    });

    it("WHEN 잠긴 동안 더 실패하면 THEN 세지 않아 잠금은 처음 잠긴 때부터 15분 뒤에 풀린다", async () => {
      const lockout = await createLockout();
      const key = newKey();
      await failTimes(lockout, key, T0, MAX_CONSECUTIVE_FAILURES);

      await failTimes(lockout, key, T0 + 60, MAX_CONSECUTIVE_FAILURES);

      expect(await lockout.isLocked(key, T0 + LOCKOUT_SECONDS)).toBe(false);
    });

    it("WHEN 첫 잠금이 풀린 뒤 다시 5번 실패하면 THEN 두 번째 잠금은 30분이다", async () => {
      const lockout = await createLockout();
      const key = newKey();
      await failTimes(lockout, key, T0, MAX_CONSECUTIVE_FAILURES);
      const second = T0 + LOCKOUT_SECONDS + 1;

      await failTimes(lockout, key, second, MAX_CONSECUTIVE_FAILURES);

      expect(await lockout.isLocked(key, second + 16 * 60)).toBe(true);
      expect(await lockout.isLocked(key, second + 2 * LOCKOUT_SECONDS)).toBe(false);
    });

    it("WHEN 잠금을 10번 거듭하면 THEN 마지막 잠금은 정확히 24시간 뒤에 풀린다", async () => {
      const lockout = await createLockout();
      const key = newKey();
      let now = T0;
      for (let lock = 1; lock < 10; lock += 1) {
        await failTimes(lockout, key, now, MAX_CONSECUTIVE_FAILURES);
        now += DAY + 1;
      }

      await failTimes(lockout, key, now, MAX_CONSECUTIVE_FAILURES);

      expect(await lockout.isLocked(key, now + DAY - 1)).toBe(true);
      expect(await lockout.isLocked(key, now + DAY)).toBe(false);
    });

    it("WHEN 두 번 잠긴 뒤 성공하고 다시 5번 실패하면 THEN 이번 잠금은 15분이다", async () => {
      const lockout = await createLockout();
      const key = newKey();
      await failTimes(lockout, key, T0, MAX_CONSECUTIVE_FAILURES);
      const second = T0 + LOCKOUT_SECONDS + 1;
      await failTimes(lockout, key, second, MAX_CONSECUTIVE_FAILURES);
      const afterSuccess = second + 2 * LOCKOUT_SECONDS + 1;
      await lockout.recordSuccess(key);

      await failTimes(lockout, key, afterSuccess, MAX_CONSECUTIVE_FAILURES);

      expect(await lockout.isLocked(key, afterSuccess + LOCKOUT_SECONDS - 1)).toBe(true);
      expect(await lockout.isLocked(key, afterSuccess + LOCKOUT_SECONDS)).toBe(false);
    });

    it("WHEN 같은 키로 실패 5개를 동시에 기록하면 THEN 그 키는 잠겨 있다", async () => {
      const lockout = await createLockout();
      const key = newKey();

      await Promise.all(
        Array.from({ length: MAX_CONSECUTIVE_FAILURES }, () => lockout.recordFailure(key, T0)),
      );

      expect(await lockout.isLocked(key, T0)).toBe(true);
    });

    // 로그인은 비밀번호를 보기 전에 시도를 센다 — 세기와 잠금 확인이 한 번에 일어나야 병렬 요청이 잠금을 건너뛰지 못한다
    it("WHEN 같은 키로 시도 10개를 동시에 기록하면 THEN 정확히 5개만 true이고 그 키는 잠겨 있다", async () => {
      const lockout = await createLockout();
      const key = newKey();

      const allowed = await Promise.all(
        Array.from({ length: 2 * MAX_CONSECUTIVE_FAILURES }, () => lockout.recordFailure(key, T0)),
      );

      expect(allowed.filter(Boolean)).toHaveLength(MAX_CONSECUTIVE_FAILURES);
      expect(await lockout.isLocked(key, T0)).toBe(true);
    });

    it("WHEN 잠금을 60번 거듭하면 THEN 기록이 실패하지 않고 마지막 잠금은 24시간 뒤에 풀린다", async () => {
      const lockout = await createLockout();
      const key = newKey();
      let now = T0;
      for (let lock = 1; lock < 60; lock += 1) {
        await failTimes(lockout, key, now, MAX_CONSECUTIVE_FAILURES);
        now += DAY + 1;
      }

      await failTimes(lockout, key, now, MAX_CONSECUTIVE_FAILURES);

      expect(await lockout.isLocked(key, now + DAY - 1)).toBe(true);
      expect(await lockout.isLocked(key, now + DAY)).toBe(false);
    });
  });
}
