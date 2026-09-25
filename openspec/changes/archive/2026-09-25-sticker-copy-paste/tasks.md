# Tasks — sticker-copy-paste

- [x] 1.1 테스트: 같은 탭 복사 · 붙여넣기 시나리오 4개(보존 · 표식 다름 · 상한 초과 · 잘라내기 이동) → verify: 빨강(기능 미구현, 표식 다름은 회귀 가드)
- [x] 1.2 테스트: 실브라우저 실제 클립보드 시나리오(Chromium · WebKit) → verify: 빨강(플러그인 등록을 빼고 확인)
- [x] 2.1 editor-core `stickerClipboard` 플러그인 · `closed-values` `stickerOrNull` · `PasteNormalizer` 확장에 등록 → verify: `pnpm --filter @blog-editor/editor-core test`
- [x] 2.2 리뷰 수정: 열린 끝 블록(세 번 클릭) 되살리기 · 되살리지 않는 자리 음성 시나리오 4개 · 실브라우저 세 번 클릭 시나리오 · StickerClipboard 확장 분리(우선순위) → verify: 단위 · e2e 초록
- [x] 2.3 재검사 뒤 수정: 닫아 붙인 뒤 커서를 붙인 글자 끝에(handlePaste) · 닫는 자리를 빈 최상위 글자 블록으로 좁힘 → verify: 단위 · e2e 초록
- [x] 3.1 adr-027 · `pnpm verify` → verify: 초록
