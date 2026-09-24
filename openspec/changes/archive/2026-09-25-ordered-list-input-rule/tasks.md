# Tasks — ordered-list-input-rule

- [x] 1.1 테스트: 입력 규칙 시나리오 5개(3. · 범위 밖 · 이어지는 번호 합치기 · 안 이어짐 · 꾸미기 있으면 안 합침) → verify: 빨강(기능 미구현)
- [x] 2.1 editor-core `closed-values` 범위 검사 · `wrap` 시작 번호 감싸기 · 입력 규칙 `n. ` + 합치기 → verify: `pnpm --filter @blog-editor/editor-core test`
- [x] 3.1 실브라우저: 플레이그라운드 빈 문단에 `3. ` → `ol start=3`, 콘솔 0 → verify: 스크린샷
- [x] 3.2 `pnpm verify` → verify: 초록
