# web-session-error-boundary (이슈 #119)

## Why

세션이 끊긴 뒤(쿠키 만료 · 삭제, 쿠키를 저장하지 못한 브라우저 #118) 캐시에 없는 화면으로 가면 글 목록 `GET /api/posts`가 401을 받고, 로그인 화면 대신 오류 화면 「화면을 그리지 못했어요」가 뜬다. 원인은 알림 순서다 — QueryCache `onError`(세션을 로그인 필요로)는 쿼리 오류와 같은 동기 구간에서 끝나지만, 두 변경(쿼리 오류 dispatch · 세션 캐시 `setQueryData`)은 각자 `notifyManager.batch`로 따로 `setTimeout(0)` flush에 실린다(@tanstack/query-core 5.103.2 `Query.fetch` · `notifyManager` flush). 글 목록 관찰자가 먼저 알림을 받아 화면(PostListPage · EditSession)이 다시 그려지며 첫 불러오기 실패를 던지고, 그 오류가 맨 위 라우트 경계로 가 가드(RequireSession)까지 가린다. 가드는 다음 알림에서야 로그인 필요를 읽는데 이미 가려져 있다.

## What Changes

- web: 가드 라우트(RequireSession)에 `errorElement` `SessionErrorBoundary`를 둔다. 화면이 던진 `UnauthorizedError`는 가드처럼 지금 경로를 `next`로 기억해 로그인 화면으로 보내고, 그 밖의 오류는 다시 던져 위 경계(RouteErrorPage)로 넘긴다
- 화면마다 401을 다루지 않는 설계(전역 QueryCache 처리 + 가드)는 그대로다

## Impact

- 편집 화면에서 저장이 401이면 지금처럼 세션 만료 띠를 보이고 로컬 초안을 남긴다(저장 mutation은 던지지 않는다 — 바뀌지 않음, 실브라우저로 확인)
- 하지 않는 것: TanStack Query 알림 순서 바꾸기(라이브러리 내부) · 화면별 401 분기 · 로컬 Safari 쿠키(#118)
