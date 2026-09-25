# Tasks — web-session-error-boundary

- [x] 1.1 테스트(실브라우저): 로그인 → 목록이 캐시에 없는 화면 → 쿠키 삭제 → 글 목록으로 → 로그인 화면 → 다시 로그인하면 글 목록 → verify: 빨강(오류 화면 「화면을 그리지 못했어요」)
- [x] 2.1 web: 가드 라우트 `errorElement` `SessionErrorBoundary`(401 → 로그인, 그 밖은 위 경계) → verify: `pnpm test:e2e`
- [x] 2.2 리뷰 뒤 테스트: 목록에서 글을 열다 401 → next 보존(빨강: 편집 주소의 오류 화면) · 목록 500 → 오류 화면(회귀 가드, 고치기 전에도 초록)
- [x] 3.1 실브라우저 확인(커밋 안 함): 편집 중 저장 401 → 만료 띠 · 다시 로그인하면 쓰던 문장이 남음
- [x] 3.2 `pnpm verify` → verify: 초록
