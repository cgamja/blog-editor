# Tasks — task-list

- [x] 1.1 테스트: 스키마 · 변환 · 직렬화 · 렌더 · 부분 고치기 시나리오
  - `checked` 통과 · 참/거짓 밖 거부
  - `- [ ]` · `- [x]` · 번호 · 안쪽 목록 → 할 일, `\[ ]`는 글자, 글 없는 할 일 항목 거부
  - 할 일 · 표지 모양 글 이스케이프 왕복, 생성기에 `checked`
  - 체크 칸 마크업, CSS 규칙, 할 일 항목 글자 부분 고치기
  - 기존 "할 일 목록 거부" 시나리오를 갱신한다
  - → verify: 빨강(기능 미구현)
- [x] 1.2 테스트: editor-core 스키마 왕복 · 토글 커맨드 · 입력 규칙 · 「바꾸기」 → verify: 빨강
- [x] 1.3 테스트: 실브라우저(Chromium · WebKit) 체크 칸 누르기 · `[ ] ` 입력 → 미리보기 체크 칸 → verify: 빨강
- [x] 2.1 content-schema `listItem.attrs.checked` · 생성기 → verify: schema 단위 초록
- [x] 2.2 content-convert 읽기 · 검사 · 쓰기 · 형식 가이드 → verify: convert 단위 초록
- [x] 2.3 content-render 마크업 · 본문 CSS → verify: render 단위 초록
- [x] 2.4 editor-core 노드 · 커맨드 · 입력 규칙 · 누르기 플러그인, editor-react 메뉴 이름 · CSS → verify: editor 단위 · e2e 초록
- [x] 2.5 공개 계약 사본 · openapi.json 다시 만들기 · adr-036 → verify: 계약 테스트 초록
- [x] 3.1 `pnpm verify` → verify: 초록
- [x] 3.2 리뷰 수정(#132 Opus): 콜아웃 안 문단 바꾸기 → 감싼 목록 항목 모두 할 일(`wrapInTaskList`), `- [ ] [ ]`는 글이 `[ ]`인 할 일(check.ts 빈 할 일 판정), 안쪽 목록 옆 여백 누르기는 토글 안 함(taskToggle 세로 범위) → verify: 빨강(f16495e) → 초록
- [x] 3.3 리뷰 정리: 목록 판정(`list-query.ts`) · 할 일 표지(content-convert constants.ts) · 체크 칸 이름(content-render messages.ts) 한 곳으로, CSS 여백 값에 변수 이름 → verify: 단위 · e2e · lint:css 초록
- [x] 3.4 재검사 수정: 체크 칸 세로 범위는 첫 줄만(여러 줄 할 일의 둘째 줄 옆 여백은 토글 안 함, `coordsAtPos`) · 에디터 체크 칸 여백 폭은 post.css `--post-list-gutter` 한 곳 → verify: 빨강(6380304) → e2e 초록
