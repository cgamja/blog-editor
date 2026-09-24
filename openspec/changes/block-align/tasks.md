# Tasks — block-align (이슈 #86)

## 1. 테스트

- [ ] 1.1 `editor-core/src/commands/align.test.ts`(커맨드 · 기본값 · 거절 · 단축키), `editor-react/src/decoration-state.test.ts`(정렬 상태), `editor-react/src/editor.test.ts`(조립본에 alignKeys) → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 `commands/align.ts` · `plugins/align-keymap.ts` · `index.ts` export → verify: 1.1 editor-core 초록
- [ ] 2.2 editor-react: `AlignKeys` 등록 · 패널 정렬 필드 · 폭 도구줄 정렬 버튼 → verify: 1.1 초록

## 3. Converge

- [ ] 3.1 실브라우저: 문단 · 제목 · 그림 세 정렬 스크린샷, 콘솔 0 → verify: `pnpm verify` 초록
