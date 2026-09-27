# Tasks — seo-others-failed

- [x] 1.1 테스트: 글 목록 요청이 실패한 채 발행 확인을 열면 점수 · 목록 대신 점검 불가 안내와 다시 시도(e2e/seo.spec.ts) → verify: 빨강
- [x] 2.1 `useSeoOtherPosts` 조회 상태 · `EditorDialogs` 점검 상태 · `SeoChecklist` 안내 + 다시 시도 → verify: 1.1 초록
- [x] 2.2 카테고리 · 중복 점검이 글 목록 쿼리 하나를 `select`로 나눠 쓴다(재시도 횟수가 쿼리 하나 기준) → verify: 1.1 WebKit 초록
- [x] 2.3 리뷰 수정 — 처음 읽는 중 `othersLoading` 안내, 실패 뒤 재시도 중에도 `othersFailed` 유지(`errorUpdateCount`), 별칭 export · `seoOtherPostsOf` 래퍼 제거, `EditorPostSummary` 이름, `SeoOthers` 판별 키 `kind` → verify: e2e/seo.spec.ts · query-keys.test.ts 초록
- [x] 3.1 `pnpm verify` → verify: 초록
