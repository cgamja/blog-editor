# Tasks — editor-custom-blocks (이슈 #40)

기존 코드: `apps/editor/editor-core/src/{extensions,doc-node}.ts`(#37 — 스키마 · 경계 함수). 커맨드는 새 파일 `src/commands/custom-blocks.ts`에만. 테스트는 Vitest node(EditorState만, DOM · EditorView 없음), 구현보다 먼저이고 `test(editor-core):` 커밋으로 분리한다.

## 1. 테스트

- [ ] 1.1 `src/test-helpers.ts`(상태 만들기 · 커맨드 실행 · 결과 docFromNode 검사) + `src/commands/custom-blocks.test.ts` — 스펙 시나리오 10개 → verify: `pnpm vitest run apps/editor/editor-core` 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 `insertCallout` · `setCalloutTone` → verify: 콜아웃 시나리오 5개 초록
- [ ] 2.2 `insertAppScreenshot` → verify: 스크린샷 시나리오 2개 초록
- [ ] 2.3 `backspaceAfterCustomBlock` · `index.ts` export → verify: 1.1 전부 초록 + `pnpm test` PASS_TO_PASS

## 3. Converge

- [ ] 3.1 시나리오 10개 ↔ 테스트 대조 → verify: `pnpm verify` 초록 출력
