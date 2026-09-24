# Tasks — list-keys (이슈 #78)

## 1. 테스트

- [ ] 1.1 `editor-core/src/plugins/list-keymap.test.ts`(Enter · Tab · Shift-Tab · Backspace · 꾸미기), `editor-react/src/editor.test.ts`(조립본에 listKeys) → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 `plugins/list-keymap.ts` · `index.ts` export · `blogEditorExtensions()`에 `ListKeys` → verify: 1.1 초록
- [ ] 2.2 `docs/ime-checklist.md` 조합 중 목록 Enter 항목

## 3. Converge

- [ ] 3.1 실브라우저: `- 가` Enter `나` Enter Enter → 두 항목 뒤 문단, Tab 들여쓰기, 콘솔 0 → verify: `pnpm verify` 초록
