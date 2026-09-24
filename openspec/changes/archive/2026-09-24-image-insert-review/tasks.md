# Tasks — image-insert-review (PR #95)

## 1. 테스트

- [x] 1.1 editor-core 커서 유지 · 경계 자리 · 붙여넣기 판정 · 슬래시 동작 항목, editor-react 동작 항목 거르기 → verify: 빨강 · 실패 원문

## 2. 구현

- [x] 2.1 editor-core `image-upload` 선택 추적 · 경계 정리, `image-file-input` 플러그인, `clearSlashQuery` · `slashActionGap`
- [x] 2.2 editor-react 올리기 주입 · 줄 · 입력 분리, 굽기 · 대체 텍스트 수정, 슬래시 「이미지」
- [x] 2.3 api 한도 별칭 제거, 플레이그라운드 fetch 구현

## 3. Converge

- [x] 3.1 실브라우저(쓰는 중 업로드 완료 · Excel식 붙여넣기 · `/이미지` · 투명 PNG) → verify: `pnpm verify` 초록
