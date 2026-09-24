import { createHash } from "node:crypto";

/** 무인 자동화 · 커넥터가 `/mcp`에 쓰는 연결용 토큰 한 행(adr-007). 저장소는 토큰 원문을 갖지 않는다. */
export interface ConnectionToken {
  /** 초안 출처 `token:<name>`이 된다 — postSourceSchema의 `[a-z0-9-]{1,32}` */
  name: string;
  tokenHash: string;
}

export interface ConnectionTokenStore {
  findByHash(tokenHash: string): Promise<ConnectionToken | null>;
}

/**
 * 연결용 토큰은 사람이 고르는 비밀번호가 아니라 무작위 고엔트로피 문자열이라 느린 해시(scrypt)가
 * 막을 추측 공격이 없다 — SHA-256으로 원문만 남기지 않는다(adr-016).
 */
export function hashConnectionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
