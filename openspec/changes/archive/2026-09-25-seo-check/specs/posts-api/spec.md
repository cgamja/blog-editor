## ADDED Requirements

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
