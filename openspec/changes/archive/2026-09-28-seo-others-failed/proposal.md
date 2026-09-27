# seo-others-failed (이슈 #166)

## Why

발행 확인의 검색 노출 점검은 제목 · 설명 중복을 보려고 `GET /api/posts`를 읽는다. 이 요청이 실패하면 훅이 빈 목록을 돌려줘, 중복 비교 없이 매긴 점수가 제대로 된 점수처럼 보였다. 사용자는 중복이 없다고 믿고 발행할 수 있다.

## What Changes

- `useSeoOtherPosts`가 다른 글과 함께 조회 상태(ready · loading · failed)를 돌려준다. 상태는 TanStack Query 하나에서 끌어낸다. 캐시된 성공 데이터가 있으면 다시 읽다 실패해도 그 데이터로 점검한다.
- 조회가 실패하면(성공 데이터 없음) 점검 칸에 점수 · 목록 대신 "다른 글 목록을 읽지 못해 제목 · 설명 중복을 점검할 수 없어요."와 「다시 시도」를 보인다. 다시 시도는 목록을 다시 읽는다.
- 읽는 중 동작은 바꾸지 않는다(비교할 글 없이 점검).
- 카테고리 제안과 중복 점검이 같은 `GET /api/posts`를 두 쿼리로 읽던 것을 쿼리 하나(`["posts", "summaries"]`)와 `select`로 합친다. 두 쿼리면 한쪽만 실패하거나 재시도가 따로 돌아 요청이 두 배가 된다.

## Impact

- web: `api.ts` · `constants.ts` · `index.ts` · `components/LoadedPostEditor.tsx` · `hooks/use-seo-other-posts.ts` · `hooks/use-publish-check.ts` · `components/EditorDialogs.tsx` · `PublishDialog.tsx` · `SeoChecklist.tsx` · `types.ts` · `messages.ts` · `editor-page.css`
- 스키마 · API · 렌더는 바뀌지 않는다.
