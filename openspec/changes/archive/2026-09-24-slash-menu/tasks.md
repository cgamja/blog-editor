# Tasks — slash-menu

## 1. 테스트

- [x] 1.1 slash-menu.test: 열기 조건 · query · 닫기 조건 · 키 넘기기 · applySlashItem → verify: 빨강 · 실패 원문
- [x] 1.2 editor-react slash-items.test: 한글 이름 · 영문 별칭 거르기

## 2. 구현

- [x] 2.1 editor-core: appendCommandSteps(공용, atTopBlock이 사용) · slashMenu 플러그인 · applySlashItem · closeSlashMenu · SlashMenu 확장 · export
- [x] 2.2 editor-react: filterSlashItems · SlashMenu 컴포넌트 · 연결

## 3. 증거

- [x] 3.1 실브라우저: `/제목` Enter · `/h` 방향키 · Esc · 한글 거르기 · 콘솔 0 → `pnpm verify` · archive
