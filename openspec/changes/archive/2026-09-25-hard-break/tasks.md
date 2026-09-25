# Tasks — hard-break

- [x] 1.1 테스트: 스키마 · 정규형 · 변환 · 직렬화 · 렌더 시나리오
  - 문단 안 통과 · 제목/칸 거부 · 끝 줄바꿈 지움
  - `\`/공백 둘 → hardBreak
  - 들여 쓴 이어진 줄 · `|` 이스케이프 · `<br>`
  - 기존 "hard break 거부" 시나리오를 갱신하고, 생성기에 hardBreak를 넣는다
  - → verify: 빨강(기능 미구현)
- [x] 1.2 테스트: editor-core Shift+Enter(문단 · 칸 · 제목 · 코드) · 붙여넣은 `<br>` · 코드 블록 ↔ 문단 바꾸기 → verify: 빨강
- [x] 1.3 테스트: 실브라우저(Chromium · WebKit) Shift+Enter → 미리보기 `<br>` → verify: 빨강
- [x] 2.1 content-schema hardBreak · 정규형 · 생성기 → verify: schema 단위 초록
- [x] 2.2 content-convert 읽기 · 검사 · 쓰기 · 형식 가이드 → verify: convert 단위 초록
- [x] 2.3 content-render `<br>` → verify: render 단위 초록
- [x] 2.4 editor-core 노드 · 커맨드 · 키 · 붙여넣기 → verify: editor 단위 · e2e 초록
- [x] 3.1 `pnpm verify` → verify: 초록
