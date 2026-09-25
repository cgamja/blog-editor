# posts-api Specification

## Purpose

에디터 화면이 쓰는 글 API(plan 3-6 · 3-7) — 목록 · 한 편 조회(ETag) · 조건부 저장과 409. 모든 입구가 서버에서 같은 zod 검증과 정규화를 지난다(닫힌 집합).

## Requirements

### Requirement: 목록과 한 편 조회는 초안을 포함하고 ETag를 준다

`GET /api/posts`는 SHALL 초안을 포함한 모든 글의 요약(`slug` · `title` · `date` · `updated?` · `category` · `draft` · `source`)을 `date` 최신순으로 준다. `GET /api/posts/:slug`는 글 파일 JSON과 `ETag` 헤더(따옴표로 감싼 revision)를 준다. 없는 글은 404, slug 모양이 아니면(`..` · 대문자 등) 400이다.

#### Scenario: 목록에 초안과 발행 글이 모두 최신순으로 나온다

- **WHEN** 초안 하나와 발행 글 둘을 저장한 뒤 `GET /api/posts`를 부른다
- **THEN** 200이고 세 글이 `date` 내림차순이며 초안의 `draft`는 `true`다

#### Scenario: 한 편 조회는 ETag를 주고 없는 글 · 잘못된 slug는 거절한다

- **WHEN** 저장된 글, 없는 slug, `Bad..Slug`를 각각 조회한다
- **THEN** 차례로 200 + `ETag: "<revision>"`, 404, 400이다

### Requirement: 저장은 조건부이고 어긋나면 409다 (보호 대상 — 고쳐서 통과시키지 않는다)

`PUT /api/posts/:slug`는 SHALL `If-None-Match: *`(새 글) 또는 `If-Match: "<revision>"`(고치기)를 요구한다. 새 글이면 201, 고치기면 200이고 둘 다 새 `ETag`를 준다. 조건 헤더가 없으면 428, revision이 어긋나거나 이미 있는 slug에 `If-None-Match: *`면 409이며 저장된 글은 바뀌지 않는다.

#### Scenario: 새 글을 만들고 받은 ETag로 고친다

- **WHEN** `If-None-Match: *`로 글을 PUT한 뒤, 받은 `ETag`를 `If-Match`에 넣어 제목을 바꿔 PUT한다
- **THEN** 201 뒤 200이고, 두 응답의 `ETag`가 다르며 조회하면 바뀐 제목이다

#### Scenario: 낡은 ETag · 이미 있는 slug · 조건 없음은 거부된다

- **WHEN** 다른 곳에서 한 번 고친 뒤 옛 `ETag`로 PUT, 있는 slug에 `If-None-Match: *`로 PUT, 조건 헤더 없이 PUT을 각각 한다
- **THEN** 차례로 409 · 409 · 428이고 저장된 글은 그대로다

### Requirement: 저장 전에 검증하고 정규형으로 저장한다

`PUT`은 SHALL 본문을 워크스페이스 카테고리로 만든 `createPostFileSchema`로 검증하고, 실패하면 400과 zod 이슈 목록(경로 · 메시지)을 주고 저장하지 않는다. 통과하면 `normalize`한 결과를 저장한다.

#### Scenario: 스키마 밖 문서는 400이고 저장되지 않는다

- **WHEN** 링크 `href`가 `javascript:alert(1)`인 글을 `If-None-Match: *`로 PUT한다
- **THEN** 400이고 이슈 경로에 `href`가 있으며 그 slug를 조회하면 404다

#### Scenario: 정규형이 아닌 문서는 정규화되어 저장된다

- **WHEN** 인접 텍스트 노드가 둘로 나뉜 문단을 PUT한 뒤 조회한다
- **THEN** 조회한 문서는 `normalize`를 거친 것과 같다(텍스트가 하나로 합쳐짐)

실패 의미론: (1) 응답 유실 후 같은 `If-Match`로 재시도하면 409 — 클라이언트는 다시 조회해 내용이 이미 반영됐는지 본다(M3 화면 몫). (2) 수명: 세션 만료는 세션 이슈 몫, 여기는 해당 없음. (3) 동시 입력: 같은 `ETag`로 두 PUT이 겹치면 하나만 성공하고 하나는 409(post-store 동시 쓰기).

### Requirement: 발행 글의 내용을 고치면 서버가 수정일을 올린다

`PUT /api/posts/:slug`는 SHALL 다음 세 조건이 모두 맞으면 저장하는 글의 `meta.updated`를 오늘(Asia/Seoul, `YYYY-MM-DD`)로 둔다.

- `If-Match`의 판이 지금 저장된 판이다
- 저장된 판과 새 판이 모두 `draft: false`다
- 제목 · 설명 · 문서(정규형) 중 하나가 바뀌었다

저장된 판과 새 판이 모두 발행 상태인데 내용이 같으면 **저장된** `updated`를 지킨다 — 편집 화면 폼에 남은 옛 값이 서버가 올린 값을 되돌리지 못한다. 새 글 · 초안 저장 · 처음 발행에서는 보낸 `updated`를 그대로 둔다. 편집 화면은 `updated`를 스스로 채우지 않고 받은 값을 그대로 보낸다. 조건부 저장과 409 규칙은 바뀌지 않는다.

#### Scenario: 발행 글 본문을 고치면 updated가 오늘이 된다

- **WHEN** 발행 글의 문단을 고쳐 맞는 `If-Match`로 PUT한 뒤 조회한다
- **THEN** `meta.updated`가 오늘이다

#### Scenario: 발행 글 제목만 고쳐도 updated가 오늘이 된다

- **WHEN** 발행 글의 제목만 고쳐 맞는 `If-Match`로 PUT한 뒤 조회한다
- **THEN** `meta.updated`가 오늘이다

#### Scenario: 초안 저장 · 처음 발행 · 같은 내용 재저장은 updated를 올리지 않는다

- **WHEN** 초안을 고쳐 저장하고, 초안을 처음 발행하고, 발행 글을 내용 그대로 다시 저장한다
- **THEN** 세 경우 모두 `meta.updated`가 없다

#### Scenario: 같은 내용 재저장은 저장된 updated를 지킨다

- **WHEN** `updated`가 `2026-09-01`인 발행 글을 폼의 옛 값 `2026-08-01`과 같은 내용으로 다시 저장한다
- **THEN** 저장된 `meta.updated`는 `2026-09-01` 그대로다
