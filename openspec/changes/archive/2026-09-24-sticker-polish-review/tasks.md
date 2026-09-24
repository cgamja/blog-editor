# Tasks — sticker-polish-review

## 1. 테스트

- [x] 1.1 sticker-hiding.test: 메타 없는 트랜잭션에서는 숨김 유지
- [x] 1.2 sticker-ui.test: `hiddenStickerRule` 새 선택자 · `cornerDistance` · `isInsideLayer` → verify: 빨강 · 실패 원문

## 2. 구현

- [x] 2.1 editor-core: 숨김 속성 상수 파일 · `DEFAULT_COORDINATES` 공개
- [x] 2.2 editor-react: Esc · 틀 밖 취소 · 겹치지 않는 손잡이 · 숨김 선택자 · 모서리 기준 크기 · 패널 드롭 폭 계산 · 숨김 해제 effect 분리

## 3. 증거

- [x] 3.1 실브라우저: 48px 스티커 누르는 칸(elementFromPoint) · Esc 취소 · 틀 밖 취소 · 크기 조절 · 제자리 클릭 · 놓을 수 없는 자리 뒤 숨김 해제 · 콘솔 0 → `pnpm verify`
