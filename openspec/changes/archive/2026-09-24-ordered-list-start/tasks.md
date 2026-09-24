# Tasks — ordered-list-start

- [x] 1.1 테스트: schema · normalize · render · convert · serialize · editor(DOM · 목록 갈림) 시나리오 → verify: 빨강(기능 미구현)
- [x] 2.1 content-schema `start` · normalize → verify: `pnpm --filter @blog-editor/content-schema test`
- [x] 2.2 content-render `<ol start>` → verify: `pnpm --filter @blog-editor/content-render test`
- [x] 2.3 content-convert 파싱 · 검사 · 직렬화 · 형식 가이드 → verify: `pnpm --filter @blog-editor/content-convert test`
- [x] 2.4 editor-core 스키마 · DOM · 목록 갈림 번호 잇기 → verify: `pnpm --filter @blog-editor/editor-core test`
- [x] 3.1 실브라우저: 플레이그라운드 번호 목록 가운데 빈 항목 Enter → 뒤 목록 번호가 이어진다, 콘솔 0 → verify: 스크린샷
- [x] 3.2 `pnpm verify` → verify: 초록
