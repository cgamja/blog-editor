# Tasks — editor-seo-panel

- [x] 1.1 테스트: 칩 점수 = 발행 확인 점수 · 설명 입력 뒤 점수 오름 · 핵심 검색어에 따른 첫 문단 여백 점 · 항목 눌러 블록으로 이동(e2e/seo-panel.spec.ts) → verify: 빨강
- [x] 2.1 editor-react: 머리줄 도구 자리 · 여백 점(`BlockMarks`) · `focusEditorBlock` → verify: typecheck · lint
- [x] 2.2 web: `seoCheckOf` 공유 · `useSeoLive`(디바운스 · 조합 미룸) · `SeoChip` 팝오버 · `useSeoJump`(블록 · 메타 칸) → verify: 1.1 초록(Chromium · WebKit)
- [x] 2.3 반응형: 640px 미만 칩 글자 숨김 · 여백 점 숨김 → verify: 1280 · 768 · 375 스크린샷
- [x] 3.1 `pnpm verify` → verify: 초록
- [x] 4.1 리뷰 재현 테스트: `selectBlock`(그림 노드 선택 · 문단 안 커서) · 여백 점 오른쪽 배치 · 팝오버 그림 항목 노드 선택 → verify: 빨강
- [x] 4.2 리뷰 수정: editor-core `selectBlock` · 점 오른쪽 여백 + 호버 강조 · 문서 바뀌면 점 비움 · 점검 메모 · `BlockFlag` 개명 · `blockFlags` 한 묶음 · `useEditorSeo` 분리 · aria-controls는 열렸을 때만 → verify: 4.1 초록(Chromium · WebKit) · 1280 · 768 · 375 스크린샷
- [x] 4.3 `pnpm verify` → verify: 초록
