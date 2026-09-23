# Tasks — api-username-login (이슈 #31)

결정은 `design.md`. 새 의존성 없음. 테스트가 구현보다 먼저이고 `test(api):` 커밋으로 분리한다. 보안 테스트(401 · 위조 · 만료 · `__Host-` · 공개 조회)의 assertion은 바꾸지 않고 식별자 필드 이름만 바꾼다.

## 1. 테스트

- [ ] 1.1 `src/test-app.ts` · `src/session.test.ts` — email → username, 아이디 정규화 시나리오 추가 → verify: `pnpm vitest run apps/editor/api` 빨강 · 실패 원문 보고
- [ ] 1.2 `src/local-config.test.ts` — 로컬 env 시나리오 → verify: 빨강

## 2. 구현

- [ ] 2.1 `src/accounts.ts` · `src/memory-account-store.ts` · `src/session.ts` · `src/messages.ts` — username 계약 · 본문 · 메시지 → verify: 1.1 초록
- [ ] 2.2 `src/local-config.ts` · `src/serve.ts` — env 해석 · 평문 해시 · 비밀 생성 → verify: 1.2 초록, `ADMIN_PASSWORD=1234`로 띄워 curl 로그인 204 → 목록 200

## 3. Converge

- [ ] 3.1 시나리오 ↔ 테스트 대조 → verify: `pnpm verify` 초록
