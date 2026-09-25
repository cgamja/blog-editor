# Tasks — paste-split-sticker-dup

- [x] 1.1 테스트: 문단 가운데 붙여넣기 시나리오 3개(앞 조각에만 · 상한 근처 거부 안 됨 · 되살린 스티커 상한 계산) → verify: 빨강(기능 미구현)
- [x] 1.2 테스트: 실브라우저 ⌘A 복사 → 같은 문단 글자 가운데 붙여넣기(Chromium · WebKit) → verify: 빨강(Expected 4, Received 6)
- [x] 2.1 editor-core `keepStickersOnOnePiece` · `stickerSafePaste` 플러그인(`StickerSafeSplit` 확장에 등록) · `stickerClipboard` 상한 계산을 `pasteTransaction`으로 → verify: `pnpm exec vitest run apps/editor/editor-core` · e2e `--repeat-each 3`
- [x] 2.2 리뷰 수정: 근거 정정(뒤 조각은 Fitter.close → openFrontierNode) · 파일 붙여넣기는 넘김 · e2e 문단별 단언 · 닫힌 문단 하나 · 파일 시나리오 → verify: 단위 · e2e 초록
- [x] 2.3 재검사 뒤 수정: 이미지 올리기와 같은 판정(pastedImageFiles)으로만 양보 — 글과 함께 온 미리보기 이미지는 이 플러그인이 다룬다 → verify: 단위 초록
- [x] 3.1 `pnpm verify` → verify: 초록
