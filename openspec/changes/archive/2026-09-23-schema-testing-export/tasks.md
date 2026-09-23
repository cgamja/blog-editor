# Tasks — schema-testing-export (이슈 #27)

기존 코드: 짝 검사는 `packages/content-schema/src/doc.ts`(`hasNaturalSizePair`), 같은 조건이 `content-convert/src/parser.ts`(`naturalSizeOf`) · `serialize.ts` · `content-render/src/render.ts`(`renderImg`)에 있다. 생성기는 `content-schema/src/doc.arbitrary.ts`(`decorationArb` · `naturalSizeArb` · `docArbitrary`)와 `content-convert/src/serialize.arbitrary.ts`(`decoration` · `naturalSize` · `losslessDocArbitrary`). 경계 린트는 `eslint.config.mjs` + `eslint.boundaries.test.ts`. 매니페스트 · 린트 설정은 보호 파일(Edit 제안 → 사람 승인).

## 1. 테스트 (빨강)

- [x] 1.1 `naturalSizeOf` 시나리오 1개(`doc.test.ts`) · testing 진입점 경계 시나리오 2개(`eslint.boundaries.test.ts`) → verify: 빨강 원문 보고

## 2. 구현

- [x] 2.1 `naturalSizeOf` export, parser · serialize · render가 사용 → verify: 1.1의 `naturalSizeOf` 초록, 스냅샷 불변
- [x] 2.2 `exports["./testing"]` → `src/doc.arbitrary.ts`, convert 생성기 중복 제거 → verify: 왕복 · 멱등 property 초록
- [x] 2.3 ESLint testing 진입점 규칙 → verify: 1.1 경계 시나리오 초록, `pnpm verify` 초록
