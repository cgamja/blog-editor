## ADDED Requirements

### Requirement: 초안 주소 바꾸기는 revision을 확인하고 발행 글은 거부한다

`POST /api/posts/{slug}/rename`은 SHALL `If-Match: "<revision>"`과 본문 `{ to }`를 받아 초안의 주소를 `to`로 옮긴다. 성공하면 200과 `{ slug, revision }`, 새 `ETag`를 주고 옛 주소의 글은 없어진다. 발행 글(`draft: false`)이면 409(주소 잠금), revision이 어긋나거나 `to`에 이미 글이 있어도 409이며 어느 쪽도 바뀌지 않는다. 조건 헤더가 없으면 428, 없는 글은 404, 주소 모양이 아니면 400이다.

#### Scenario: 초안을 새 주소로 옮긴다

- **WHEN** 초안을 저장하고 받은 `ETag`로 `to: "new-home"`을 보낸다
- **THEN** 200이고 `new-home`을 조회하면 같은 글, 응답 `ETag`와 같은 revision이며 옛 주소는 404다

#### Scenario: 발행 글은 주소를 바꿀 수 없다

- **WHEN** `draft: false`인 글에 받은 `ETag`로 주소 바꾸기를 보낸다
- **THEN** 409이고 옛 주소의 글은 그대로, 새 주소는 404다

#### Scenario: 낡은 revision · 이미 있는 주소는 거부된다

- **WHEN** 한 번 고친 뒤 옛 `ETag`로 보내고, 다른 글이 있는 주소로 보낸다
- **THEN** 둘 다 409이고 두 글 모두 그대로다

#### Scenario: 조건 없음 · 없는 글 · 잘못된 주소

- **WHEN** `If-Match` 없이, 없는 글에, `to: "Bad_Slug"`로 각각 보낸다
- **THEN** 차례로 428 · 404 · 400이다
