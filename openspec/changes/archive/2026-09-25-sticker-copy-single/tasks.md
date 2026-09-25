# Tasks — sticker-copy-single

- [x] 1.1 테스트: `pasteStickerBeside` 시나리오 3개(옆에 붙음 · 범위 끝 반대쪽 · 상한) → verify: 빨강(기능 미구현)
- [x] 1.2 테스트: 실브라우저 스티커 고르고 ⌘C · ⌘V(Chromium · WebKit) → verify: 빨강
- [x] 2.1 editor-core `pasteStickerBeside` + export → verify: `pnpm exec vitest run apps/editor/editor-core`
- [x] 2.2 editor-react `StickerLayer` 복사 · 붙여넣기 키(keydownHandler) · 상한 안내 · 키 안내 문장 → verify: e2e `--repeat-each 3`
- [x] 3.1 `pnpm verify` → verify: 초록
