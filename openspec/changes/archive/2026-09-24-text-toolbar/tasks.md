# Tasks — text-toolbar (이슈 #85)

## 1. 테스트

- [x] 1.1 editor-core `commands/text-style.test.ts` — 합치기 · 지우기 · 두께 · 검증 · 같은 값 · 대상 없음 · 요약 · 마지막 색 · 키맵 → verify: 빨강 · 실패 원문 보고
- [x] 1.2 editor-react `text-toolbar-model.test.ts` — 대비 · hex 입력 · 자리 → verify: 빨강

## 2. 구현

- [x] 2.1 `commands/text-style.ts` · `plugins/text-style-keymap.ts` · export → verify: 1.1 초록
- [x] 2.2 `text-toolbar-model.ts` → verify: 1.2 초록
- [x] 2.3 `TextToolbar.tsx` · 색 · 드롭다운 · `text-toolbar.css` · 링크 이벤트 · 플레이그라운드 → verify: typecheck, 실브라우저(글꼴 · 두께 · 크기 · 색 · #hex 경고 · 여러 값), 콘솔 오류 0

## 3. Converge

- [x] 3.1 시나리오 ↔ 테스트 · 증거 대조 → verify: `pnpm verify` 초록
