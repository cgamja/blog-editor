# Tasks — local-loopback-session-cookie

- [x] 1.1 테스트: 루프백 모드 쿠키 속성 · 그 쿠키로 목록 200 · 모드가 다른 쿠키는 401 · 로그아웃이 같은 이름을 지움 · PUBLIC_BASE_URL 유무로 모드 결정 → verify: 빨강(기능 미구현)
- [x] 2.1 session.ts 쿠키 모드 · local-config.ts 모드 결정 · serve.ts 전달 → verify: `pnpm exec vitest run apps/editor/api`
- [x] 3.1 playwright.config.ts WebKit 프로젝트 · CI WebKit 설치 → verify: `pnpm test:e2e` chromium · webkit 6개 통과
- [x] 3.2 `pnpm verify` → verify: 초록
