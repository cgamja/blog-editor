# design — edit-screen

## 1. 경로와 편집 세션

`/posts/new`와 `/posts/:slug/edit`는 경로 없는 레이아웃 라우트 하나(`EditPostPage`) 아래 둔다. 새 글이 처음 저장되거나 주소를 바꾸면 화면이 스스로 새 주소로 `navigate(replace)`하는데, 이때 에디터를 다시 만들면 커서 · undo가 날아간다. 그래서 편집 세션 키를 따로 두고(`nextEditingSession`), 화면이 스스로 옮긴 주소(adopt)면 키를 그대로, 그 밖의 경로 변화(목록에서 다른 글)는 새 키로 한다. 편집 화면은 내비 없는 전체 화면이라 앱 셸(#96) 밖, 가드 안이다. 화면 파일은 `features/editor/pages/`, 밖에서는 `features/editor/index.ts`로만 들어온다.

## 2. 저장

- 본문 `{ schemaVersion, meta, doc }`. `If-None-Match: *`(아직 서버에 없는 글) 또는 `If-Match: "<revision>"`.
- 저장을 막는 빈칸(`missingForSave`): 제목 · 설명 · 카테고리 빈칸, 주소가 slug 모양이 아님. 빈칸이 있으면 서버에 보내지 않고 머리줄에 무엇이 비었는지 적는다. localDraft는 그대로 쓴다.
- 자동 저장(`createAutosave`): 바뀔 때마다 2초 디바운스. 시각이 왔을 때 `view.composing`이면 다시 2초 미룬다(조합 중에는 문서를 읽고 쓰는 부수 효과를 미룬다 — CLAUDE.md). 저장 중에 또 바뀌면 끝난 뒤 한 번 더. ⌘S · 「초안 저장」은 `flush`(즉시).
- ⌘S 판정은 `event.code === "KeyS"` — 한글 자판에서는 `key`가 "ㄴ"이다.
- 발행한 글은 자동 저장하지 않는다 — 저장이 곧 공개 글 변경이다. ⌘S · 「초안 저장」 · 「발행」 모두 확인 대화상자("고친 내용을 공개 글에 반영해요")를 거친다.
- 실패 분류(`saveErrorKindOf`): 401 → 만료 띠, 409 + 새 글 → 주소 칸 "이미 쓰는 주소", 409 → 충돌 대화상자, 그 밖 → "저장하지 못했어요 · 다시 시도"(400이면 서버 이슈 문장).

## 3. 세션 만료(401)

전역 `onError`는 401이면 세션을 로그인 필요로 바꿔 가드가 곧장 로그인 화면으로 보낸다. 편집 화면의 저장은 쓰던 글을 두고 떠나지 않도록 mutation `meta.expiresSessionOnUnauthorized: false`로 빠지고, 띠("로그인이 끝났어요. 쓰던 글은 이 브라우저에 남아 있어요. [다시 로그인]")를 보인다. 「다시 로그인」은 localDraft를 쓰고 `/login?next=<이 글>`로 간다. 돌아오면 불러온 revision이 localDraft의 기준 revision과 같으면 localDraft를 되살리고 곧 저장한다. 다르면 그사이 다른 곳에서 바뀐 것이라 충돌 대화상자를 연다(`restoreDecisionOf`).

## 4. 충돌(409, 디자인 67:2)

- 「내 글을 복사해 두고 최신 글 열기」: 본문 텍스트를 클립보드에(거부되면 넘어감), 문서 JSON을 localDraft 사본 키에 두고, 최신 글을 다시 불러 에디터를 새로 만든다.
- 「저장하지 않고 계속 쓰기」: 닫고 자동 저장을 멈춘다(머리줄 "저장하지 못했어요 · 다시 시도"). 다시 시도해도 409면 같은 대화상자.
- 「최신 글을 버리고 내 글로 덮어쓰기」: 최신 revision을 다시 받아 그것으로 `If-Match` 저장.

## 5. 주소 바꾸기 API

`POST /api/posts/{slug}/rename` 본문 `{ to }`, `If-Match` 필수(없으면 428). 옛 글이 없으면 404, 발행 글이면 409(주소 잠금), revision이 어긋나면 409, `to`에 글이 있으면 409. 순서: 새 주소에 `put(to, file, null)` → 옛 주소 `delete(from, revision)`. 둘째가 실패하면 새 주소를 지워 되돌린다(같은 프로세스 안 — 운영 원자성은 S3 몫, adr-014와 같은 한계). 응답 200 `{ slug, revision }` + `ETag`.

## 6. 미리보기

공개 렌더러는 서버에만 있다(web → content-render 엣지 없음). `POST /api/preview` `{ doc }` → `{ html }`: `docSchema` 검증 뒤 `renderHtml(normalize(doc))`, 공개 API와 같은 `imageBaseUrl`. 세션이 필요한 `/api` 아래라 초안이 공개 쪽에 나가지 않는다. web은 `<iframe sandbox="allow-same-origin" srcdoc>`에 `/public/post.css`와 함께 넣는다 — 스크립트 허용 없음, 같은 출처는 이미지(CORP same-site) 때문.

## 7. 버린 것

- web에서 content-render 직접 import: 엣지 추가(adr-009 변경)가 필요하다.
- `GET /public/...`로 미리보기: 초안을 공개 쪽에 내면 안 된다.
- 발행 전용 경로: 계약대로 발행 = `PUT draft: false`.
