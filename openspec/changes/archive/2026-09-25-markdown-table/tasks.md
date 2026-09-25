# Tasks — markdown-table

- [x] 1.1 테스트: 스키마 · 변환 · 직렬화 · 렌더 · CSS 시나리오(표 통과 · 모양 거부 · GFM 표 → table · 자리 밖 거부 · 직렬화 파이프 · thead/tbody 렌더 · 스크롤 규칙), 기존 "표는 정의 밖" 시나리오 갱신, 생성기 · 픽스처에 표 → verify: 빨강(기능 미구현)
- [x] 1.2 테스트: editor-core 표 시나리오(왕복 · Tab · 행 · 열 · 머리 행 지우기 정렬 · 거절) · 슬래시 목록 11개 → verify: 빨강
- [x] 1.3 테스트: 실브라우저(Chromium · WebKit) 슬래시로 표 넣기 · Tab · 미리보기 표 · 375px 가로 스크롤 → verify: 빨강
- [x] 2.1 content-schema 표 스키마 · 정규형 · 생성기 · 픽스처, adr-028 → verify: `pnpm --filter @blog-editor/content-schema test`(vitest 경로)
- [x] 2.2 content-convert 표 읽기 · 검사 · 쓰기 · 형식 가이드 → verify: convert 단위 초록
- [x] 2.3 content-render 표 HTML · post.css → verify: render 단위 초록
- [x] 2.4 editor-core 표 노드 · 플러그인 · 커맨드 · 키, editor-react 메뉴 · 에디터 모양 → verify: editor 단위 · e2e 초록
- [x] 3.1 `pnpm verify` → verify: 초록
