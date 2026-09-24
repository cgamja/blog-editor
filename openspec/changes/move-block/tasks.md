# Tasks — move-block (이슈 #43)

기존 코드: `apps/editor/editor-core/src/{extensions,doc-node,index}.ts`(스키마 · 경계 함수). 병렬 작업 #40(`commands/custom-blocks.ts`) · #41(`plugins/block-guard.ts`)과 겹치지 않게 새 파일 하나에만 쓴다. 테스트는 Vitest node(EditorState, DOM 없음), 구현보다 먼저 `test(editor-core):` 커밋.

## 1. 테스트

- [ ] 1.1 `src/commands/move-block.test.ts` — 스펙 시나리오 7개 → verify: `pnpm vitest run apps/editor/editor-core` 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 `src/commands/move-block.ts` — `moveBlockUp` · `moveBlockDown` · `moveBlockKeymap` · `MoveBlock`, `index.ts` export → verify: 1.1 초록 + `pnpm test` PASS_TO_PASS

## 3. Converge

- [ ] 3.1 시나리오 7개 ↔ 테스트 대조 → verify: `pnpm verify` 초록
