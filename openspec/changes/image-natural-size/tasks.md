# Tasks — image-natural-size (이슈 #24)

기존 코드: attrs 스키마는 `packages/content-schema/src/doc.ts`(`imageAttrsSchema` · `appScreenshotAttrsSchema`), 렌더는 `packages/content-render/src/render.ts`(`renderImg`), 지시어는 `packages/content-convert/src/directives.ts` · `parser.ts` · `serialize.ts` · `constants.ts`, 가이드 `packages/content-convert/guide/format.md`. `post.css`는 이미 `figure img { width: 100%; height: auto }`. 테스트 task가 먼저이고 `test(…)` 커밋으로 분리한다.

## 1. 테스트 (빨강)

- [x] 1.1 스키마 — 시나리오 2개(`doc.test.ts`) → verify: 빨강 원문 보고
- [x] 1.2 렌더 — 시나리오 1개(`render.test.ts`) → verify: 빨강 원문 보고
- [x] 1.3 변환 · 직렬화 — 시나리오 3개(`convert.test.ts` · `serialize.test.ts`) → verify: 빨강 원문 보고

## 2. 구현

- [x] 2.1 `doc.ts` — `NATURAL_SIZE_RANGE` · 짝 검사, 두 arbitrary(content-schema · content-convert)에 크기 → verify: 1.1 초록 · 왕복 property 초록
- [x] 2.2 `render.ts` — `width` · `height` 속성 → verify: 1.2 초록
- [x] 2.3 변환 — `size` 키(허용 · 값 검사 · 메시지 · 파서 · 직렬화) + 가이드 표 → verify: 1.3 초록
- [ ] 2.4 픽스처 `allBlocks` · `decorationMax` 이미지에 크기, 스냅샷 · 계약 파일 갱신(크기 속성 추가 외 차이 없음) → verify: `pnpm verify` 초록
