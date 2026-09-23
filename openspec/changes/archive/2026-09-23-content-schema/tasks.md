# Tasks — content-schema (이슈 #5)

기존 코드: `packages/content-schema/src/meta.ts`(`SCHEMA_VERSION` · `slugSchema` · `imagePathSchema` · `createPostMetaSchema`)와 `index.ts`. 새 파일은 같은 `src/` 아래에 두고 `index.ts`에 named export만 더한다. 테스트는 Vitest node(DOM 없음). 테스트 task가 구현 task보다 먼저이며 `test(schema):` 커밋으로 분리한다.

## 1. 문서 · 꾸미기 스키마

- [x] 1.1 `src/doc.test.ts` — document-schema · decoration-schema의 시나리오 12개(블록 통과 · 정의 밖 거부 · 내용 규칙 · href 허용/거부 · 이미지 경로 · tone/language · 꾸미기 최대 · 범위 밖 · 자리 밖 · 스티커 13/12) → verify: `pnpm vitest run packages/content-schema/src/doc.test.ts` 빨강(모듈 없음이 아니라 export가 없어 실패하는 형태가 되도록 `./doc`에서 `docSchema`를 import) · red 출력 원문 보고
- [x] 1.2 `src/doc.ts` — `docSchema` + 노드 · 마크 · 꾸미기 스키마 · `hrefSchema` · 스티커 합계 12 `superRefine`. `z.lazy`로 listItem 재귀. `index.ts`에 export → verify: 1.1 초록 + `meta.test.ts` 유지

## 2. PostFile · 마이그레이션

- [x] 2.1 `src/post-file.test.ts` — post-file 시나리오 5개(세 칸 통과 · 불일치/누락/여분 · 현재 버전 그대로 · 미래/없음/문자열 → `MigrationError` · `migrations.length === SCHEMA_VERSION - 1`) → verify: 빨강 원문 보고
- [x] 2.2 `src/post-file.ts` — `createPostFileSchema` · `migrations` · `migrate` · `MigrationError`. `index.ts` export → verify: 2.1 초록 + PASS_TO_PASS

## 3. 정규화 (fast-check 게이트 포함)

- [x] 3.1 fast-check LIBRARY 게이트 — `docs/spec/LIBRARY.md` 2단계 표로 보고 → **사람 승인** → `package.json` devDependency는 Edit 제안(사람이 diff 승인) → `adr/2026-09-23-adr-012-fast-check-property-tests.md` → `chore(deps):` 커밋. 거부 시 3.2의 멱등성 테스트를 예제 5개로 대체하고 여기 기록 → verify: `pnpm install` 후 `import fc from "fast-check"` typecheck
- [x] 3.2 `src/normalize.test.ts` — document-normalize 시나리오 5개(마크 순서 · 인접 병합 · href 다르면 유지 · 키 순서 · 멱등성 100회 property + 결과가 `docSchema` 통과). arbitrary는 `src/doc.arbitrary.ts`(테스트 전용, index export 없음) → verify: 빨강 원문 보고
- [x] 3.3 `src/normalize.ts` — `normalize(doc)`: 마크 사전순 · 빈 marks/attrs 키 제거 · 인접 텍스트 병합 · 키 순서 고정 · 입력 불변. `index.ts` export → verify: 3.2 초록 + PASS_TO_PASS

## 4. 픽스처

- [x] 4.1 `src/fixtures.test.ts` — document-fixtures 시나리오 3개(세 픽스처 파싱 · 정규형 · 버전 / allBlocks 커버리지 / invalidFixtures 5개 거부 + 실패 위치) → verify: 빨강 원문 보고
- [x] 4.2 `src/fixtures.ts` — `fixtures.{minimal, allBlocks, decorationMax}` · `invalidFixtures[]`. `index.ts` export → verify: 4.1 초록

## 5. Converge

- [x] 5.1 스펙 5개의 `#### Scenario` 25개 ↔ 테스트 이름("WHEN … THEN …") 1:1 대조, 빠진 것은 여기 append. 이슈 #5의 "zod ↔ ProseMirror 일치 속성 테스트"는 M2 이슈로 남긴다(TODO 아님) → verify: `pnpm verify` 초록 출력
