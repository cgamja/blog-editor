# Tasks — mcp-oauth (이슈 #36)

기존 코드: `apps/editor/api/src/mcp/`(도구 6개 · 연결용 토큰 · `route.ts`), `session.ts`(username 로그인 · 서명 쿠키). 이 change는 같은 서비스에 OAuth 인가 서버를 붙인다(`src/mcp/oauth/`). 새 의존성 없음. 결정은 design.md. 테스트는 Vitest node, `app.request()`. 테스트 task가 구현보다 먼저이고 `test(api):` 커밋으로 분리한다.

## 1. 테스트

- [x] 1.1 `src/mcp/oauth/oauth.test.ts` — 새 시나리오 26개(mcp-auth 4 · mcp-oauth-server 6 · mcp-oauth-grant 13 · api-session 3 — 잠금은 `session.test.ts`) → verify: `pnpm vitest run apps/editor/api` 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `oauth/store.ts` · `oauth/memory-oauth-store.ts` — 클라이언트 · 코드 · 액세스 · refresh 계약과 메모리 구현(해시만, 클라이언트 상한) → verify: 1.1의 등록 · 토큰 시나리오 초록
- [x] 2.2 `oauth/redirect-uris.ts` · `oauth/pkce.ts` — 허용 목록(루프백 포트 무시) · S256 → verify: 등록 · PKCE 시나리오 초록
- [x] 2.3 `oauth/routes.ts` · `oauth/pages.ts` · `oauth/messages.ts` — 메타데이터 · `/register` · `/authorize`(로그인 + 동의, Origin 검사) · `/token` → verify: grant 시나리오 초록
- [x] 2.4 `session.ts`(로그인 확인 · 세션 확인 함수로) · `mcp/route.ts`(OAuth 토큰 · `resource_metadata`) · `mcp/env.ts` · `serve.ts`(`PUBLIC_BASE_URL`) → verify: 1.1 전부 초록 + `pnpm test` PASS_TO_PASS

## 3. Converge

- [x] 3.1 로컬 스모크(메타데이터 → 등록 → authorize → token → tools/list) · `docs/mcp-connect.md` 2-b 갱신 · 시나리오 ↔ 테스트 대조 → verify: `pnpm verify` 초록 출력
