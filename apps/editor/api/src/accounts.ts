/**
 * 계정 테이블(adr-007 · D13) — 1단계는 시드 1행이지만 "비밀번호 하나"가 아니라 행 구조로 둔다.
 * 저장 백엔드(DynamoDB 등)는 M4에서 같은 계약으로 붙인다.
 */
export interface Account {
  id: string;
  email: string;
  /** `hashPassword`가 만든 문자열 — 원문 비밀번호는 어디에도 두지 않는다 */
  passwordHash: string;
  workspaceId: string;
}

export interface AccountStore {
  /** email은 대소문자 · 앞뒤 공백을 무시하고 찾는다 */
  findByEmail(email: string): Promise<Account | null>;
}
