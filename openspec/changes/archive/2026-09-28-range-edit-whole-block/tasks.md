# Tasks — range-edit-whole-block

- [x] 1.1 테스트: 블록 전체 후보 하나 · 둘 · 없음 → verify: 앞의 둘 빨강, 셋째 초록(회귀 가드)
- [x] 2.1 content-convert 후보 고르기 · 애매함 메시지 한 줄 → verify: convert 단위 초록
- [x] 2.2 형식 가이드 · MCP update_draft 설명 · ADR-038 → verify: `pnpm docs:check`
- [x] 3.1 `pnpm verify` → verify: 초록
- [x] 4.1 리뷰(#158 Opus) 반영 테스트: 지우기 제외 · 표 칸/목록 항목 제외 · 글자 `...` · 되지 않는 안내 없음 → verify: 넷 빨강, insert_after 회귀 가드 초록
- [x] 4.2 블록 전체 고르기 좁히기(지우기 · 최상위 블록만 · 글자 그대로로 돌아온 범위) · 안내 문구 → verify: convert 단위 초록
- [x] 4.3 형식 가이드 · MCP 설명 · ADR-038 · 스펙 맞춤 → verify: `pnpm exec openspec validate range-edit-whole-block --strict` · `pnpm verify`
