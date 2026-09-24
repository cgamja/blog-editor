# Design — web-post-list-review

## 1. 로그아웃 실패(web-post-list design §4를 바꾼다)

`useLogout`은 `onSuccess`에서만 로그인 화면으로 옮기고 캐시를 비운다. `DELETE /api/session`이 실패하면(네트워크 · 5xx) 쿠키가 아직 유효하므로 화면도 세션 캐시도 그대로 두고, 메뉴의 로그아웃 자리에 오류 문장과 다시 시도를 보인다. 로그인 화면으로 보내면 사용자는 공용 컴퓨터를 떠나도 된다고 믿는다.

## 2. 목록 응답 확인

`parsePostList(body)`: `posts` 배열인지, 항목마다 `slug` · `title` · `date` · `category` · `source`가 문자열인지, `draft`가 불리언인지, `updated`는 없거나 문자열인지 본다. 틀리면 `posts[3].draft: 불리언이 아니다` 모양의 오류. 키 목록은 `POST_SUMMARY_KEYS`(필수) · `POST_SUMMARY_OPTIONAL_KEYS` 한 곳이고, 테스트가 계약의 `PostList.posts.items`의 `properties` · `required`와 같은지 본다 — 계약이 바뀌면 web이 빨갛다.

## 3. 토큰

- `font` 그룹의 px 값(ui 15 · caption 13 · h2 25 + 새 row-title 16 · note 17 · brand 24 · page-title 34) → `--font-size-<이름>`(rem). `h1`("34-36px")은 범위라 건너뛴다 — 목록 · AI 연결 제목은 캔버스 66:2 · 70:2가 34px라 `page-title`로 둔다
- `shadow` 그룹: `"<x> <y> <blur> [<spread>] <색 토큰 이름> <불투명도>%"`, 여러 겹은 `, `. → `x y blur spread color-mix(in srgb, var(--<색>) N%, transparent)`. 색 이름이 color 그룹에 없거나 모양이 다르면 생성이 멈춘다. 캔버스의 `rgba(58, 43, 38, a)`는 `ink`(#3a2b26)다
  - `paper` · `paper-contact` = 68:2 글 종이의 두 겹(`0 18px 40px -18px ink 35%` · `0 2px 6px ink 8%`) — 로그인 카드("종이 위 카드"). 여러 겹 값은 prettier가 줄을 나눠 생성본과 어긋나므로 한 토큰에 한 겹만 두고 쓰는 쪽이 `var(--shadow-paper), var(--shadow-paper-contact)`로 잇는다
  - `note` = 68:2 포스트잇(`0 6px 12px -4px ink 25%`) — 빈 목록 안내
  - `note-tag` = 66:2 "AI가 올린 초안"(`0 2px 4px ink 12%`)
- 토큰이 아닌 값은 app.css 머리에 이름을 붙여 둔다: 포스트잇 줄 간격 1.35(68:2 포스트잇), 로그인 카드 · 빈 목록 글 폭(결정 아티팩트 1 · 2의 모형 300 · 320px을 실제 화면 폭으로 맞춘 값). 제목 줄 간격은 캔버스가 정하지 않아(normal) 지운다

## 4. 층 린트

`features/**` 블록: `../**/app` 금지, 다른 기능은 index까지 금지(`../../<다른 기능>` · `../<다른 기능>`). 기능끼리 필요한 것은 app이 조합하거나 shared로 내린다(ARCHITECTURE "feature 간 직접 import 금지"). #97 · #98도 라우터(app)에서 조합한다.
