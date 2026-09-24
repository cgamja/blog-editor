# Tasks — edit-screen (이슈 #97)

## 1. 테스트

- [ ] 1.1 api `rename.test.ts` · `preview.test.ts` · post-store 계약 `delete`, web `slug` · `post-meta` · `save-model` · `autosave` · `local-draft` · `editing-session` 시나리오 → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 post-store `delete` · rename · preview 라우트 · 계약 표 → `api/openapi.json` → verify: api 테스트 · 계약 테스트 초록
- [ ] 2.2 web 순수 함수(slug 제안 · 빈칸 · 저장 헤더 · 실패 분류 · 상태 문구 · 자동 저장 · localDraft · 편집 세션) → verify: 1.1 web 초록
- [ ] 2.3 editor-react `EditorScreen` 제목 · 띠 자리 · 바깥 탭 → verify: typecheck · 플레이그라운드 그대로
- [ ] 2.4 web 편집 화면(불러오기 · 글 정보 · 저장 · 401 띠 · 409 대화상자 · 발행 · 미리보기) · query-client meta → verify: typecheck · lint
- [ ] 2.5 실브라우저(로컬 API 8902 + web 5302): 새 글 → 저장 → 발행, 두 탭 409, ⌘S, 자동 저장, 401 띠 → verify: 스크린샷 · 콘솔 오류 0

## 3. Converge

- [ ] 3.1 시나리오 ↔ 테스트 · 증거 대조 → verify: `pnpm verify` 초록 · `openspec validate --all --strict`
