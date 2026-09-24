# Tasks — mcp-drafts (이슈 #32)

기존 코드: `apps/editor/api`에 `createApp`(글 API · 공개 조회 · 세션)과 로컬 진입점 `serve.ts`가 있다. 이 change는 `/mcp`(도구 6개 · 연결용 토큰)를 새 폴더 `src/mcp/`에 더한다. 결정은 adr-016. 새 의존성 `@modelcontextprotocol/server ~2.0.0`. 테스트는 Vitest node, `app.request()`로 JSON-RPC를 보낸다. 테스트 task가 구현보다 먼저이고 `test(api):` 커밋으로 분리한다. OAuth는 하지 않는다.

## 1. 의존성

- [x] 1.1 adr-016 · `apps/editor/api/package.json`(SDK · content-convert · zod) · lockfile → verify: `pnpm install` 뒤 `pnpm audit --prod` 취약점 없음

## 2. 테스트

- [x] 2.1 `src/mcp/mcp.test.ts` — 스펙 시나리오 15개(mcp-drafts 11 · mcp-auth 4) → verify: `pnpm vitest run apps/editor/api` 빨강 · 실패 원문 보고

## 3. 구현

- [x] 3.1 `src/mcp/connection-tokens.ts` · `memory-connection-token-store.ts` — 토큰 계약 · SHA-256 · 메모리 구현 → verify: mcp-auth 시나리오 초록
- [x] 3.2 `src/mcp/tools.ts` · `messages.ts` · `route.ts` · `app.ts` 마운트 — 도구 6개 · 초안 규칙 · 충돌 → verify: 2.1 초록 + `pnpm test` PASS_TO_PASS
- [x] 3.3 `src/serve.ts` · `src/index.ts` — `MCP_CONNECTION_TOKEN`(32자 이상) · `MCP_CONNECTION_TOKEN_NAME` → verify: 로컬 서버에 JSON-RPC initialize → tools/list → create_draft 스모크

## 4. Converge

- [x] 4.1 스펙 시나리오 15개 ↔ 테스트 대조 · 연결 절차 문서 → verify: `pnpm verify` 초록 출력
