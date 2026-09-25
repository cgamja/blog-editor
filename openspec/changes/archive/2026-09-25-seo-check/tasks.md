# Tasks — seo-check

- [x] 1.1 테스트: `checkSeo` 규칙 표(규칙마다 걸리는 입력 · 안 걸리는 입력) → verify: 빨강(함수 없음)
- [x] 1.2 테스트: meta `keyword` 스키마 · 공개 조회에 keyword 없음 → verify: 빨강
- [x] 1.3 테스트: MCP 쓰기 도구 응답의 `seo` · `keyword` 저장 · 서버 instructions → verify: 빨강
- [x] 1.4 테스트: API PUT이 발행 글 내용 변경에서만 `updated`를 올린다 → verify: 빨강
- [x] 1.5 테스트(실브라우저): 발행 확인에 점검 목록 · 핵심 검색어 칸 → verify: 빨강
- [x] 2.1 content-schema `checkSeo` · 상수 · `keyword` → verify: `pnpm test`
- [x] 2.2 api: PUT `updated` · MCP `seo` · `keyword` · `instructions` · 형식 가이드 → verify: `pnpm test`
- [x] 2.3 web: 발행 확인 점검 목록 · 핵심 검색어 칸 → verify: `pnpm test:e2e`
- [x] 3.1 openapi · 공개 계약 사본 재생성(바뀌면) · ADR-030 · `pnpm verify` → verify: 초록
