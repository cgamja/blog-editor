# Tasks — editor-custom-blocks (이슈 #40)

기존 코드: `apps/editor/editor-core/src/{extensions,doc-node}.ts`(#37 — 스키마 · 경계 함수). 커맨드는 새 파일 `src/commands/custom-blocks.ts`에만. 테스트는 Vitest node(EditorState만, DOM · EditorView 없음), 구현보다 먼저이고 `test(editor-core):` 커밋으로 분리한다.

## 1. 테스트

- [x] 1.1 `src/commands/custom-blocks.test.ts`(상태 만들기 · 커맨드 실행 · 결과 docFromNode 검사 헬퍼 포함) — 스펙 시나리오 13개 → verify: `pnpm vitest run apps/editor/editor-core` 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `insertCallout` · `setCalloutTone` → verify: 콜아웃 시나리오 7개 초록
- [x] 2.2 `insertAppScreenshot` → verify: 스크린샷 시나리오 3개 초록
- [x] 2.3 `backspaceAfterCustomBlock` · `index.ts` export → verify: 1.1 전부 초록 + `pnpm test` PASS_TO_PASS

## 3. Converge

- [x] 3.1 시나리오 13개 ↔ 테스트 대조 → verify: `pnpm verify` 초록 출력

## 후속 (이 change 밖)

- editor-react: `.ProseMirror-selectednode` 표시 · 키맵에서 `backspaceAfterCustomBlock`을 기본 Backspace 체인 앞에 등록
- #44 실브라우저 체크리스트: "커스텀 블록 뒤 Backspace 두 번 — 첫 번째에 선택이 보이고 두 번째에 지워진다"(design 4)
