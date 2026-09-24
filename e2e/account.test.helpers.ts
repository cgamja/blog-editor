/**
 * playwright.config.ts가 api를 이 계정으로 띄우고, 시나리오가 이 계정으로 로그인한다.
 * 루프백 전용 테스트 서버라 짧은 비밀번호를 받는다(local-config.ts). 사람의 `.env` 계정과 따로 둔다 —
 * 테스트가 개인 비밀번호를 알 필요가 없다.
 */
export const E2E_ACCOUNT = { username: "e2e", password: "e2e-password" } as const;
