import type { Account, AccountStore } from "./accounts";

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** 1단계 시드용 — 로컬 진입점이 env의 1행을 넣는다. 꺼낼 때 복제해 호출자와 객체를 공유하지 않는다. */
export function createMemoryAccountStore(accounts: readonly Account[]): AccountStore {
  const byUsername = new Map(
    accounts.map((account) => [normalizeUsername(account.username), account]),
  );
  return {
    async findByUsername(username) {
      const account = byUsername.get(normalizeUsername(username));
      return account === undefined ? null : { ...account };
    },
  };
}
