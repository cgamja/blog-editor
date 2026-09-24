# Tasks — text-toolbar-review

## 1. 테스트

- [x] 1.1 editor-core `text-style.test.ts` — setTextStyle은 기억하지 않음 · rememberColor · 거절된 ⌘U는 삼킴 → verify: 빨강
- [x] 1.2 editor-react `text-toolbar-model.test.ts` — shouldShowToolbar → verify: 빨강

## 2. 구현

- [x] 2.1 editor-core rememberColor · swallowing → verify: 1.1 초록
- [x] 2.2 editor-react 표시 조건 · 포커스 복귀 · 재측정 · 정리 → verify: 1.2 초록, 실브라우저(연속 적용 · 끄는 중 숨김 · ⌘A · 틀 오른쪽 끝), 콘솔 0

## 3. Converge

- [x] 3.1 `pnpm verify` 초록
