# Tasks — block-guard (이슈 #41)

기존 코드: `apps/editor/editor-core`(스키마 · `docToNode` · `docFromNode`). 테스트는 Vitest node, DOM 없음 — `EditorState.apply`로 본다. 테스트 task가 구현보다 먼저이고 `test(editor-core):` 커밋으로 분리한다.

## 1. 테스트

- [x] 1.1 `src/plugins/block-guard.test.ts` — 스펙 시나리오 7개 → verify: `pnpm vitest run apps/editor/editor-core` 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `src/plugins/block-guard.ts` — `blockGuard()` 플러그인(filterTransaction · WeakMap 판정 기억), `index.ts` export → verify: 1.1 초록 + `pnpm test` PASS_TO_PASS

## 3. Converge

- [x] 3.1 시나리오 7개 ↔ 테스트 대조 → verify: `pnpm verify` 초록 출력
