# Tasks — public-posts-contract (이슈 #8의 에디터 레포 몫)

기존 코드: 메타 규칙은 `packages/content-schema/src/meta.ts`의 `createPostMetaSchema`(strictObject — `.shape`로 필드 재사용), 렌더는 `@blog-editor/content-render`의 `renderHtml`과 `post.css`. API(`apps/editor/api`)는 아직 없다 — 응답을 만드는 핸들러는 M1. 사이트 레포 작업은 별도(사이트 `feat/blog-api-posts`). 테스트 task가 먼저이고 `test(…)` 커밋으로 분리한다.

## 1. 응답 스키마

- [x] 1.1 `packages/content-schema/src/public-api.test.ts` — 시나리오 3개(모양 통과 · 모르는 키/겹치는 slug 거부 · 초안 거부[보호]) → verify: 빨강 원문 보고
- [x] 1.2 `packages/content-schema/src/public-api.ts` + `index.ts` export `createPublicPostsResponseSchema` · 타입 `PublicPostsResponse` → verify: 1.1 초록

## 2. 계약 픽스처

- [x] 2.1 `packages/content-render/src/contract.test.ts` — 픽스처 3개 → 응답 → 스키마 통과 + `toMatchFileSnapshot`로 `contract/public-api/public/posts` · `post.css` 비교 → verify: 첫 실행 빨강(파일 없음) 원문 보고, `-u`로 생성 후 초록
- [x] 2.2 `contract/public-api/README.md` — 띄우는 법(`python3 -m http.server`), 다시 만드는 법, 사이트가 import하지 않는다는 것 → verify: `pnpm verify` 초록
