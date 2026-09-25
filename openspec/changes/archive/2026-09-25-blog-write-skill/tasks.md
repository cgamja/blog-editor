# Tasks — blog-write-skill

- [x] 1.1 테스트: 스킬의 example 블록이 모두 형식 검사를 통과한다 → verify: 빨강(스킬 파일 없음)
- [x] 2.1 `.claude/skills/blog-write/SKILL.md` — 준비 · 글 종류 · 리서치 · 방향 확인(멈춤) · 본문과 꾸밈 · 저장과 자가 수정 · claude-seo(선택) · 보고 → verify: 1.1 초록
- [x] 2.2 로컬 API(임시 저장 루트)에서 예시 markdown으로 `check_draft` · `create_draft`가 도는지 확인 → verify: 도구 응답 ok
- [x] 2.3 리뷰 수정: 다시 저장할 때 get_post 위에서 고치기 · losses가 있으면 묻기 · 충돌 시 다시 읽기 · edit 인자 우선 · 색 프리셋 분리 · 발행 글만 내부 링크 · 글꼴 소문자 · editorUrl 바꾸는 조건 · 안 되는 문법 목록 대신 형식 가이드 따르기 · 추출 블록 수 단언 → verify: 단위 초록
- [x] 3.1 `pnpm verify` → verify: 초록
- [x] 4.1 PR 전 수동: Claude Code에서 `/blog-write <주제>` → 방향 확인에서 멈추고 초안이 저장되지 않았는지 확인 → verify: 수동(main이 한다)
- [x] 4.2 PR 전 수동: 방향 확인에 답하고 끝까지 → 초안 저장 · 에디터 링크가 나오고 발행은 안 됐는지 확인 → verify: 수동(main이 한다)
