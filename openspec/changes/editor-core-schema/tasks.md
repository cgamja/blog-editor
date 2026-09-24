# Tasks — editor-core-schema (이슈 #37)

기존 코드: 저장 형식은 `packages/content-schema`(zod · 정규형 · 픽스처 · `./testing` 생성기). editor-core 패키지는 없다(경계 린트 블록만 있다 — adr-009). 테스트는 Vitest node, DOM 없음. 테스트 task가 구현보다 먼저이고 `test(editor-core):` 커밋으로 분리한다.

## 1. 의존성 · 패키지

- [x] 1.1 `apps/editor/editor-core/{package.json,tsconfig.json}` · `@tiptap/core` · `@tiptap/pm` 3.31.3 · lockfile → verify: `pnpm install` 뒤 `pnpm audit --prod` 취약점 없음

## 2. 테스트

- [x] 2.1 `src/schema.test.ts` — 스펙 시나리오 6개 → verify: `pnpm vitest run apps/editor/editor-core` 빨강 · 실패 원문 보고

## 3. 구현

- [x] 3.1 `src/extensions.ts` — 노드 · 마크 · attrs 확장, `createEditorSchema()` → verify: 구조 위반 시나리오 초록
- [x] 3.2 `src/doc-node.ts` — `docToNode` · `docFromNode` → verify: 2.1 초록 + `pnpm test` PASS_TO_PASS

## 4. Converge

- [x] 4.1 시나리오 6개 ↔ 테스트 대조 · 후속 이슈 목록(커스텀 블록 · blockGuard · pasteNormalizer · 블록 옮기기 · IME 체크리스트) → verify: `pnpm verify` 초록 출력

## 후속 (이 change 밖)

- adr-013의 약속(content-convert PM 스키마도 같은 속성 테스트) — ② `convertMarkdown` 결과가 editor 스키마를 왕복한다는 속성 테스트를 editor-core에 둔다 — 이슈 #38. (① convert가 editor-core 스키마를 쓰게 바꾸기는 엣지 방향 역행이라 불가)
- 생성기 확장: docArbitrary의 텍스트가 ASCII뿐이다 — 한글 · 깊은 목록 중첩 · codeBlock `language`를 넣어 왕복 표본을 넓힌다
