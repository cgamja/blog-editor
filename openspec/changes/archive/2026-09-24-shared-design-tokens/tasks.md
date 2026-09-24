# Tasks — shared-design-tokens (이슈 #103)

## 1. 테스트

- [x] 1.1 `tokens-css.test.ts`를 design-tokens로 옮기고 경로만 고친다 · `eslint.boundaries.test.ts`에 design-tokens 경계(잎 · web/editor-react만 허용) → verify: 옮긴 테스트 초록, 경계 테스트는 린트 설정 전 빨강

## 2. 구현

- [x] 2.1 adr-023 · `packages/design-tokens`(생성기 · 스크립트 · tokens.css) · adr-009 표 · `eslint.config.mjs` 엣지 → verify: 1.1 초록
- [x] 2.2 web 진입점 · 가져오기 미리보기 · 플레이그라운드가 `@blog-editor/design-tokens/tokens.css`를 불러온다 → verify: typecheck
- [x] 2.3 editor-react CSS 간격 · 선 · 포커스 고리 → 토큰, 척도 밖 값 목록 → verify: 플레이그라운드 · web 1360 전후 스크린샷 동일

## 3. Converge

- [x] 3.1 `pnpm verify` 초록 · `openspec validate --all --strict`
