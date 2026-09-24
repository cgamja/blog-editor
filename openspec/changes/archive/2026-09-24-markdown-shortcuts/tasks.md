# Tasks — markdown-shortcuts (이슈 #70)

## 1. 테스트

- [x] 1.1 `editor-core/src/plugins/markdown-shortcuts.test.ts`(입력 규칙 · 조합 · Backspace 되돌리기 · 단축키), `commands/link.test.ts`, `editor-react/src/editor.test.ts`(조립본) → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `commands/turn-into.ts` · `commands/link.ts` · `plugins/markdown-shortcuts.ts` · `index.ts` export → verify: 1.1 초록
- [x] 2.2 editor-react: `blogEditorExtensions()`에 `MarkdownShortcuts`, `LinkPopover`(⌘K), 문장은 `messages.ts`
- [x] 2.3 `docs/ime-checklist.md` 한글 조합 중 `- ` · `## ` 항목

## 3. Converge

- [x] 3.1 실브라우저: 규칙별 타이핑 결과 · Backspace 되돌리기 · ⌘K 링크, 콘솔 0 → verify: `pnpm verify` 초록
