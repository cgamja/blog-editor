# Tasks — spacing-tokens (이슈 #101)

## 1. 테스트

- [ ] 1.1 `tokens-css.test.ts` — 간격 토큰 시나리오 → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 Figma 추출(읽기 전용) → `design/tokens.json` `space` · `size` 길이 토큰 · `design/map.md` 출처 표
- [ ] 2.2 `tokensToCss` `space` 그룹 · `tokens.css` 재생성 → verify: 1.1 초록
- [ ] 2.3 `app.css` 손으로 쓴 블록 → 생성 토큰 + `--app-space-*` 별칭 → verify: 실브라우저 로그인 화면 스크린샷

## 3. Converge

- [ ] 3.1 `pnpm verify` 초록 · `openspec validate --all --strict`
