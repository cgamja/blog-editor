# Tasks — decoration-panel (이슈 #60)

테스트는 Vitest node(EditorState만)로, 구현보다 먼저 `test:` 커밋.

## 1. 테스트

- [ ] 1.1 editor-react `decoration-state.test.ts` — 패널 상태 · 선택지 시나리오 → verify: 빨강 · 실패 원문 보고
- [ ] 1.2 editor-core `motion-preview.test.ts` — 미리 보기 장식 시나리오 → verify: 빨강

## 2. 구현

- [ ] 2.1 editor-core `plugins/motion-preview.ts` · export → verify: 1.2 초록
- [ ] 2.2 editor-react `decoration-state.ts` → verify: 1.1 초록
- [ ] 2.3 `DecorationPanel.tsx` · `WidthToolbar.tsx` · `editor.css` · 확장 등록 · 플레이그라운드 → verify: 실브라우저 스크린샷 · 콘솔 오류 0

## 3. Converge

- [ ] 3.1 시나리오 ↔ 테스트 대조 → verify: `pnpm verify` 초록
