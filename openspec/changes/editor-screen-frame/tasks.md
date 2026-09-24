# Tasks — editor-screen-frame (이슈 #72)

## 1. 테스트

- [ ] 1.1 editor-react `screen-tabs.test.ts` — 탭 키 이동 시나리오 → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 `screen-tabs.ts` → verify: 1.1 초록
- [ ] 2.2 `EditorScreen.tsx` · `screen-messages.ts` · `editor-screen.css` · export → verify: typecheck
- [ ] 2.3 플레이그라운드(기본 = 틀, `?dev` = 확인 도구) → verify: 1360 · 1280 · 768 스크린샷, 콘솔 오류 0

## 3. Converge

- [ ] 3.1 시나리오 ↔ 테스트 · 증거 대조 → verify: `pnpm verify` 초록
