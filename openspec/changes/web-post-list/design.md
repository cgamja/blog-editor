# Design — web-post-list

## 1. 세션 확인 경로

`GET /api/session` 핸들러는 204만 준다. 세션 판정은 이미 `/api/*` 미들웨어(`requireSession`)가 한다 — 세션이 없으면 핸들러에 오기 전에 401이다. `SESSION_FREE_METHODS`는 POST · DELETE뿐이라 GET은 열리지 않는다(그 주석이 이 경우를 예고했다). 본문을 주지 않는 이유: 화면에 필요한 계정 정보(이름)가 계정 테이블에 없고, 있는 것(아이디 · workspaceId)은 화면이 쓰지 않는다.

## 2. 앱 틀과 라우트

```
errorElement
├─ /login                         LoginPage
├─ RequireSession
│  ├─ AppShell (왼쪽 메뉴 + Outlet)
│  │  ├─ /            PostListPage(dialogs)
│  │  ├─ /connect     자리 표시(#98)
│  │  └─ /settings    자리 표시(#98)
│  ├─ /posts/new       자리 표시(#97) — 편집은 메뉴 없는 전체 화면(Figma 68:2)
│  └─ /posts/:slug/edit
└─ *                              NotFoundPage
```

`AppShell`은 `app/`에 둔다 — 여러 기능(auth의 로그아웃 · posts의 링크)을 조합하는 층이다. 메뉴 항목은 `app/nav-items.ts` 상수 하나.

## 3. 목록의 순수 함수(features/posts/post-list.ts)

- `countByTab(posts)` · `postsOfTab(posts, tab)` · `tabOf(param)` — 탭 값은 `?tab=`에서 읽고 모르는 값은 전체
- `isAiDraft(post)` — 초안이고 `source !== "editor"`. 발행된 글은 표시하지 않는다(문구가 "초안")
- `lastEditedOf(post)` = `updated ?? date`, `lastEditedLabel` = "9월 21일"(월 · 일, 숫자로 조립 — Intl 출력은 환경마다 공백이 다르다)
- `sortByLastEdited` — 고친 날 최신순, 같으면 slug
- `listDialogOf(param)` — `import` · `write-ai`만, 그 밖은 null

목록 응답 타입은 web에 따로 둔다(`features/posts/types.ts`). content-schema 의존을 다시 들이지 않는다 — 필요한 것은 `source` 문자열과 날짜 문자열뿐이고, 계약 파일이 원천이다. 응답은 `posts` 배열인지 확인만 하고(깨진 응답은 오류 경계), 생성기가 들어오면 생성 타입으로 바꾼다.

## 4. 로그아웃

`logout(client)`: `DELETE /api/session`(apiRequest) → `navigate(/login, replace)` → `markSignedOut(client)` = `client.clear()` 뒤 세션 캐시를 `anonymous`로. 이동을 먼저 해야 가드가 지금 경로를 `next`로 붙이지 않는다. DELETE가 실패해도(네트워크) 쿠키는 남지만 화면은 로그인 화면으로 간다 — 서버가 멱등이라 다음 로그인이 덮는다.

## 5. 대화상자 자리(#98 연결점)

`PostListPage({ dialogs })`, `dialogs: Partial<Record<ListDialog, ComponentType<{ onClose(): void }>>>`. 버튼은 `?dialog=<이름>`으로 링크하고, 페이지는 `listDialogOf(searchParams)`에 맞는 컴포넌트를 그린다. 닫기는 `dialog` 파라미터를 지운다. #98은 대화상자 컴포넌트를 만들어 `app/router.tsx`에서 `dialogs`로 넘기면 된다 — 목록 안을 고치지 않는다.

## 6. 스타일

`app.css`에 화면별 절을 더한다. 색 · 글꼴 · 반경 · 높이는 tokens.css 변수, 간격은 app.css 머리의 `--app-space-*`. 표는 CSS grid(Figma 66:2의 열 너비 140 · 110 · 110)이고 768 이하에서는 카테고리 · 고친 날 열을 접는다. 글꼴은 플레이그라운드처럼 Google Fonts(IBM Plex Sans KR · Jua · Gaegu)를 index.html에서 불러온다.
