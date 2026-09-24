# Tasks — editor-core-schema (이슈 #37)

기존 코드: 저장 형식은 `packages/content-schema`(zod · 정규형 · 픽스처 · `./testing` 생성기). editor-core 패키지는 없다(경계 린트 블록만 있다 — adr-009). 테스트는 Vitest node, DOM 없음. 테스트 task가 구현보다 먼저이고 `test(editor-core):` 커밋으로 분리한다.

## 1. 의존성 · 패키지

- [ ] 1.1 `apps/editor/editor-core/{package.json,tsconfig.json}` · `@tiptap/core` · `@tiptap/pm` 3.31.3 · lockfile → verify: `pnpm install` 뒤 `pnpm audit --prod` 취약점 없음

## 2. 테스트

- [ ] 2.1 `src/schema.test.ts` — 스펙 시나리오 5개 → verify: `pnpm vitest run apps/editor/editor-core` 빨강 · 실패 원문 보고

## 3. 구현

- [ ] 3.1 `src/extensions.ts` — 노드 · 마크 · attrs 확장, `createEditorSchema()` → verify: 구조 위반 시나리오 초록
- [ ] 3.2 `src/doc-node.ts` — `docToNode` · `docFromNode` → verify: 2.1 초록 + `pnpm test` PASS_TO_PASS

## 4. Converge

- [ ] 4.1 시나리오 5개 ↔ 테스트 대조 · 후속 이슈 목록(커스텀 블록 · blockGuard · pasteNormalizer · 블록 옮기기 · IME 체크리스트) → verify: `pnpm verify` 초록 출력
