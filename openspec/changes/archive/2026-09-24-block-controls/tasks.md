# Tasks — block-controls

## 1. 재현

- [x] 1.1 실브라우저로 지금 끌기 · 손잡이 클릭 · 그림 폭 조절 재현(design.md 1)

## 2. 테스트

- [x] 2.1 block-controls.test: deleteTopBlock · atTopBlock · turnTopBlockInto · resizedWidthPercent
- [x] 2.2 width-preview.test: 장식 · 해제 · 거부
- [x] 2.3 editor-react block-geometry.test: autoScrollStep → verify: 빨강 · 실패 원문

## 3. 구현

- [x] 3.1 editor-core: 커맨드 · 순수 함수 · widthPreview 플러그인 · export
- [x] 3.2 editor-react: 끄기 문턱 · 잔상 · 자동 스크롤 · 블록 메뉴
- [x] 3.3 editor-react: 그림 · 스크린샷 좌우 폭 손잡이

## 4. 증거

- [x] 4.1 실브라우저 전후 비교 · 콘솔 0 → `pnpm verify` · archive
