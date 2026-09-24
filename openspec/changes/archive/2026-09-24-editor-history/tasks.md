# Tasks — editor-history (이슈 #68)

## 1. 테스트

- [x] 1.1 `editor-core/src/plugins/history.test.ts`(단축키 표 · 콜아웃 넣기 undo · 블록 옮기기 undo), `editor-react/src/editor.test.ts`(조립본에 history) → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `plugins/history.ts` · `index.ts` export · `blogEditorExtensions()`에 `History` → verify: 1.1 초록
- [x] 2.2 `docs/ime-checklist.md` 조합 중 ⌘Z 항목

## 3. Converge

- [x] 3.1 실브라우저: 입력 → ⌘Z, 블록 위로 옮기기 → ⌘Z, 콘솔 0 → verify: `pnpm verify` 초록
