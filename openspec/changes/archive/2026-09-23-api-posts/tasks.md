# Tasks — api-posts (이슈 #19)

기존 코드: `apps/editor/api`는 없다. 스키마 · 정규화 · 공개 응답 스키마 · 픽스처는 `@blog-editor/content-schema`, HTML · 본문용 CSS는 `@blog-editor/content-render`에서만 가져온다(ESLint 경계, adr-009). D12 로컬 우선 — 클라우드 · Supabase 없이 Hono를 로컬 Node에서, 저장은 `FilePostStore`, 테스트는 `MemoryPostStore`. 핸들러 테스트는 `app.request()`로 서버를 띄우지 않고 Vitest node에서 돈다. 세션 · MCP · build hook · slug 잠금은 하지 않는다(이슈 #19 "하지 않는 것").

## 1. 패키지 뼈대

- [x] 1.1 ADR-014(Hono + `@hono/node-server`) · `apps/editor/api/package.json` · `tsconfig.json` → 사람 승인(보호 파일) → 인자 없는 `pnpm install` → verify: `pnpm audit --prod` 취약점 없음
- [x] 1.2 `src/store.ts`(`PostStore` · `ConflictError` 타입) · `src/app.ts`(`createApp` 스텁) · `src/index.ts` → verify: `pnpm typecheck` 초록

## 2. 테스트 (red)

- [x] 2.1 `src/post-store.contract.ts`(공용 스위트) + `memory-store.test.ts` · `file-store.test.ts` — post-store 시나리오 6개. `src/posts.test.ts` — posts-api 6개. `src/public.test.ts` — public-posts-api 3개(계약 픽스처를 핸들러 출력과 비교 — 계약 README "M1 핸들러 출력 비교". content-render `contract.test.ts`는 커밋된 테스트라 훅이 쉘 삭제를 막아 남김, 같은 스냅샷을 봐서 어긋날 수 없다 — 정리는 후속). 보호 테스트(409 · 초안 없음 · `javascript:`)는 고쳐서 통과시키지 않는다 → verify: 빨강 · 실패 원문 보고 · `test(api):` 커밋

## 3. 구현

- [x] 3.1 `MemoryPostStore` · `FilePostStore`(내용 해시 revision, slug별 직렬화, 임시 파일 → rename) → verify: 스토어 테스트 초록
- [x] 3.2 `createApp({ store, categories, imageBaseUrl })` — `/api/posts` 목록 · 조회 · 조건부 PUT(428 · 409 · 400 · 정규화), `/public/posts` · `/public/post.css` → verify: `pnpm test` 초록
- [x] 3.3 `src/serve.ts` 로컬 Node 진입점(`PORT` · 저장 루트 env) + 계약 README의 "M1 핸들러 출력 비교" 반영 → verify: 로컬 기동 후 `curl /public/posts`가 계약 모양

## 4. Converge

- [x] 4.1 스펙 시나리오 15개 ↔ 테스트 대조, 빠진 것 append → verify: `pnpm verify` 초록 출력

## 5. 리뷰 반영 (2축 · 재검사 1회)

- [x] 5.1 리뷰 재현 테스트(draft 없는 저장 파일이 공개 조회에 새지 않음 · slug 아닌 파일이 목록을 깨지 않음) → verify: red 관찰 후 `test(api):`
- [x] 5.2 수정 패스 — 공개 조회는 `draft === false`만, 계약 재검사에 실제 draft 값 · 목록은 slug 모양 파일만 · 응답 문장 `messages.ts` · 하위 `.claude/state` 무시 → verify: `pnpm verify`
