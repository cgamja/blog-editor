# Tasks — editor-wrap (이슈 #45)

기존 코드: `apps/editor/editor-core/src/{extensions,doc-node}.ts` · `plugins/block-guard.ts`. 커맨드는 새 파일 `src/commands/wrap.ts`에만 둔다. 테스트는 Vitest node(EditorState만)로 하고, 구현보다 먼저 `test(editor-core):` 커밋으로 분리한다.

## 1. 테스트

- [ ] 1.1 `src/commands/wrap.test.ts` — 스펙 시나리오 6개. 모든 실행에서 can(dispatch 없음)과 실행의 답이 같은지, 결과가 `docFromNode`를 통과하는지 본다 → verify: `pnpm vitest run apps/editor/editor-core` 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 `wrapInBlockquote` · `wrapInCallout` (findWrapping + wrap, 꾸미기 옮기기) → verify: 인용 · 콜아웃 시나리오 초록
- [ ] 2.2 `wrapInBulletList` · `wrapInOrderedList` (wrapRangeInList) · `index.ts` export → verify: 1.1 전부 초록 + `pnpm test` PASS_TO_PASS

## 3. Converge

- [ ] 3.1 시나리오 6개 ↔ 테스트 대조 → verify: `pnpm verify` 초록 출력
