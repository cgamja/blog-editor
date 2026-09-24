# Tasks — editor-decoration (이슈 #57)

새 파일 `apps/editor/editor-core/src/commands/decoration.ts`. 테스트는 Vitest node(EditorState만)로, 구현보다 먼저 `test(editor-core):` 커밋.

## 1. 테스트

- [x] 1.1 `src/commands/decoration.test.ts` — 스펙 시나리오. 모든 실행에서 can과 실행의 답이 같은지, 결과가 `docFromNode`를 통과하는지 본다 → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `closed-values.ts` `stickerOrNull` · 대상 블록 판정 · `setBlockFont` · `setBlockMotion` · `setBlockWidth`
- [x] 2.2 스티커 커맨드 넷 · `placeOnNearestBlock` · `index.ts` export → verify: 1.1 전부 초록

## 3. Converge

- [x] 3.1 시나리오 ↔ 테스트 대조 → verify: `pnpm verify` 초록
