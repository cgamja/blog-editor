# Tasks — markdown-shortcuts-review (PR #75 리뷰)

## 1. 테스트

- [ ] 1.1 선택 · 단어 안 `*` · 조합 끝 · ⌘D 삼키기 · 여러 줄 코드 블록 · 링크 대상 조회 → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 파일 나누기(입력 규칙 · 키맵 · 조립) — 동작 그대로
- [ ] 2.2 인라인 규칙 · ⌘D · 코드 블록 바꾸기 · 링크 조회 → verify: 1.1 초록
- [ ] 2.3 editor-react: `useLinkShortcut`(event.code), `linkHrefAt` · `hasLinkTarget` 사용, CSS 변수

## 3. Converge

- [ ] 3.1 실브라우저: 선택 후 `*`, ⌘D 상한에서 북마크 안 뜸, 링크 정확 선택 후 ⌘K, `2*3*`, 콘솔 0 → verify: `pnpm verify` 초록
