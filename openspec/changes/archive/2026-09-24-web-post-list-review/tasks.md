# Tasks — web-post-list-review (PR #104)

## 1. 테스트

- [x] 1.1 web `posts/api.test.ts`(응답 확인 · 계약 키) · `tokens-css.test.ts`(글자 크기 · 그림자) · `eslint.boundaries.test.ts`(기능 층) → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `parsePostList` · 키 상수, 첫 불러오기 실패만 오류 경계 → verify: 1.1 초록
- [x] 2.2 로그아웃 실패 표시 · 다시 시도 → verify: 실브라우저
- [x] 2.3 토큰 생성기 · tokens.json · map.md · app.css → verify: 토큰 테스트 초록
- [x] 2.4 eslint features 층 · 목록 구조 정리(본문 추출 · 빈 목록 children · 머리 동작 숨김 · 768 날짜 열) → verify: lint · typecheck
- [x] 2.5 실브라우저 1360 · 768 · 375 + 로그아웃 실패 → verify: 스크린샷 · 콘솔 오류 0

## 3. Converge

- [x] 3.1 `pnpm verify` 초록 · `openspec validate --all --strict`
