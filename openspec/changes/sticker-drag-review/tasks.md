# Tasks — sticker-drag-review

## 1. 테스트

- [ ] 1.1 decoration.test: `placeOnNearestBlock` 시나리오 삭제, 같은 값 `updateSticker` 시나리오 추가
- [ ] 1.2 sticker-edit.test: 보조키 · 지우기 키 · 개수 시나리오 추가 → verify: 빨강 · 실패 원문
- [ ] 1.3 sticker-ui.test: 문장 헬퍼 import를 `sticker-messages`로

## 2. 구현

- [ ] 2.1 editor-core: 같은 값 no-dispatch · 보조키 · `isStickerRemoveKey` · `stickerCount` · `stickersIn` · `placeOnNearestBlock` 제거
- [ ] 2.2 editor-react: 문장 모듈 · 타입 모듈 · 미리보기 분리 · 제스처/선택 훅 · 레이어 좌표 · 테두리 유지 · 포인터 id · 끄는 중 문서 변경 취소

## 3. 증거

- [ ] 3.1 실브라우저(headless + CDP): 옮기기 · 크기 · 회전 · 키보드 · Cmd+- 통과, 콘솔 0 → `pnpm verify`
