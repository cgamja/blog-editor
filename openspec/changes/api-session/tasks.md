# Tasks — api-session (이슈 #23)

기존 코드: `apps/editor/api`에 `createApp`(글 API · 공개 조회)과 로컬 진입점 `serve.ts`가 있다. 이 change는 로그인(세션 쿠키) · 계정 테이블 계약 · `/api/*` 세션 검사를 더한다. 결정은 `design.md`. 새 의존성 없음(`node:crypto` + `hono/cookie`). 테스트는 Vitest node, 테스트 task가 구현보다 먼저이고 `test(api):` 커밋으로 분리한다. 연결용 토큰 · OAuth · MCP · 로그인 화면은 하지 않는다(이슈 #23 "하지 않는 것").

## 1. 테스트

- [ ] 1.1 `src/test-app.ts` — 테스트 앱 헬퍼(시드 계정 · 낮은 N 해시 · 지연 0 · 로그인한 쿠키를 붙이는 요청). 기존 `posts.test.ts` · `public.test.ts`는 이 헬퍼로 로그인한 요청을 쓰게 바꾼다(assertion은 그대로) → verify: typecheck 통과 여부와 무관하게 이 두 파일의 기대값 diff 0
- [ ] 1.2 `src/session.test.ts` · `src/password.test.ts` — 스펙 시나리오 9개 → verify: `pnpm vitest run apps/editor/api` 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 `src/password.ts` · `src/accounts.ts` · `src/hash-password.ts` — scrypt 해시/검증 · `AccountStore` 계약과 메모리 구현 · 해시 만드는 CLI → verify: password 테스트 초록
- [ ] 2.2 `src/session.ts` · `src/app.ts` · `src/messages.ts` — 로그인/로그아웃 라우트 · `/api/*` 세션 미들웨어 · 옵션 검증 → verify: 1.2 초록 + `pnpm test` PASS_TO_PASS
- [ ] 2.3 `src/serve.ts` · `src/index.ts` — env 필수값 · 시드 계정 · 루프백 주석 → verify: env 없이 실행하면 이유를 말하고 종료, 있으면 로그인 → 목록 200 (curl)

## 3. Converge

- [ ] 3.1 스펙 시나리오 9개 ↔ 테스트 대조 → verify: `pnpm verify` 초록 출력
