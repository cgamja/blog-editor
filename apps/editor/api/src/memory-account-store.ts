import type { Account, AccountStore } from "./accounts";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 1단계 시드용 — 로컬 진입점이 env의 1행을 넣는다. 꺼낼 때 복제해 호출자와 객체를 공유하지 않는다. */
export function createMemoryAccountStore(accounts: readonly Account[]): AccountStore {
  const byEmail = new Map(accounts.map((account) => [normalizeEmail(account.email), account]));
  return {
    async findByEmail(email) {
      const account = byEmail.get(normalizeEmail(email));
      return account === undefined ? null : { ...account };
    },
  };
}
