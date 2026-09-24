# Tasks — web-scaffold (이슈 #93)

## 1. 테스트

- [x] 1.1 web `session.test.ts` · `routes.test.ts` · `tokens-css.test.ts` — 세션 판정 · next 경로 · 로그인 경로 · 토큰 동기화 시나리오 → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 ADR-022 · web `package.json`(새 의존성, 보호 파일 — PR diff로 승인) → verify: `pnpm why react` 한 벌 · `pnpm audit --prod`
- [x] 2.2 순수 함수(`sessionStateOf` · `safeNextPath` · `loginPathFor` · `tokensToCss`) + 토큰 생성 스크립트 · `tokens.css` → verify: 1.1 초록
- [x] 2.3 Vite 설정 · 라우터 · 가드 · 오류 경계 · 자리 표시 화면 · 최소 로그인 폼 → verify: typecheck · lint
- [x] 2.4 실브라우저 스모크(로컬 API + web): `/` → `/login` → 로그인 → `/` → verify: 스크린샷 · 콘솔 오류 0

## 3. Converge

- [x] 3.1 시나리오 ↔ 테스트 · 증거 대조 → verify: `pnpm verify` 초록 · `openspec validate --all --strict`
