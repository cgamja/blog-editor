# Tasks — seo-score

- [x] 1.1 테스트: `scoreSeo` 감점 표(빈 목록 100 · 등급별 · 같은 규칙 한 번 · 0 바닥) · `checkSeo`가 hardBreak를 한 글자로 센다 → verify: 빨강
- [x] 1.2 테스트: MCP 쓰기 도구 응답의 `seoScore` → verify: 빨강
- [x] 1.3 테스트(실브라우저): 발행 확인에 점수가 보인다 → verify: 빨강
- [x] 2.1 content-schema `scoreSeo` · 감점 상수 · hardBreak 글자 → verify: `pnpm test`
- [x] 2.2 api: MCP `seoScore` · 도구 설명 · instructions · 형식 가이드 → verify: `pnpm test`
- [x] 2.3 web: 발행 확인 점수 → verify: `pnpm test:e2e` · 스크린샷
- [x] 3.1 ADR-034 · `pnpm verify` → verify: 초록
- [x] 3.2 리뷰 수정: 목록 요약 description · seoOthersOf(web · MCP 같은 점수) · 자기 글만이면 internal-link 없음 · check_draft 메타 안내 · 가이드 감점 표 검사 → verify: `pnpm verify`
