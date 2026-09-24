# Tasks — web-post-list (이슈 #96)

## 1. 테스트

- [x] 1.1 api `session.test.ts` · `openapi.test.ts`(세션 확인), web `post-list.test.ts` · `session-cache.test.ts`(로그아웃) → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 계약 표에 `GET /api/session` → `api/openapi.json` 재생성 → 핸들러 → verify: api 테스트 초록
- [x] 2.2 web 세션 확인 경로 교체 · `markSignedOut` · 로그아웃 → verify: auth 테스트 초록
- [x] 2.3 목록 순수 함수 · API · 훅 → verify: 1.1 초록
- [x] 2.4 `AppShell` · 로그인 A안 · 목록 · 빈 목록 · 대화상자 자리 · 스타일 · 글꼴 → verify: typecheck · lint
- [x] 2.5 실브라우저(로컬 API 8901 + web 5301): 로그인 실패 · 성공 · 목록 · 탭 · 빈 목록 · 로그아웃, 1360 · 768 · 375 → verify: 스크린샷 · 콘솔 오류 0

## 3. Converge

- [x] 3.1 시나리오 ↔ 테스트 대조 → verify: `pnpm verify` 초록 · `openspec validate --all --strict`
