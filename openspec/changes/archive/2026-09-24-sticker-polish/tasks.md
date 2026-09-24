# Tasks — sticker-polish

## 1. 재현

- [x] 1.1 실브라우저로 "잘 안 옮겨진다" 재현 · 원인 기록(design.md 1)

## 2. 테스트

- [x] 2.1 sticker-edit.test: 24px 한도 시나리오 → 멀리 놓아도 허용 끝, 맞는 블록 없으면 null
- [x] 2.2 decoration.test: 기본 크기 8
- [x] 2.3 sticker-hiding.test: 숨김 장식 · 해제 · 문서 변경 시 해제
- [x] 2.4 sticker-ui.test: `resizeCursor` · `hiddenStickerRule` · `stickerName`(꼬리표 시나리오 삭제) → verify: 빨강 · 실패 원문

## 3. 구현

- [x] 3.1 editor-core: `placeStickerNear` 한도 제거 · 기본 크기 · `stickerHiding` 플러그인 · export
- [x] 3.2 editor-react: 꼬리표 삭제 · 끄는 중 숨김 · 불투명 유령 · 네 모서리 조절점 · 커서 · 패널 드롭 48px

## 4. 증거

- [x] 4.1 실브라우저 같은 시나리오 전후 비교 · 커서 getComputedStyle 기록 · 콘솔 0 → `pnpm verify`
