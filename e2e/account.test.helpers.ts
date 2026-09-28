/**
 * playwright.config.ts가 api를 이 계정으로 띄우고, 시나리오가 이 계정으로 로그인한다.
 * 루프백 전용 테스트 서버라 짧은 비밀번호를 받는다(local-config.ts). 사람의 `.env` 계정과 따로 둔다 —
 * 테스트가 개인 비밀번호를 알 필요가 없다.
 */
export const E2E_ACCOUNT = { username: "e2e", password: "e2e-password" } as const;

/**
 * 실브라우저 층 api가 `/mcp`를 여는 연결용 토큰(32자 이상 — mcp/env.ts). AI가 고친 초안을 만들 때
 * 시나리오가 이 토큰으로 `/mcp`를 직접 부른다(web dev 서버는 `/mcp`를 프록시하지 않는다).
 */
export const E2E_MCP_TOKEN = "e2e-connection-token-0123456789abcdef";
