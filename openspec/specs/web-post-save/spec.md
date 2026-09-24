# web-post-save Specification

## Purpose

편집 화면 저장 — 조건 헤더, 실패 분류(401 · 409 · 400), 머리줄 저장 문구, 브라우저에 남은 글 되살리기(이슈 #97).

## Requirements

### Requirement: 저장 요청은 서버에 있는지에 따라 조건 헤더를 고른다

web은 SHALL `saveHeadersOf(revision)`로 저장 조건 헤더를 만든다. revision이 없으면(아직 서버에 없는 글) `If-None-Match: *`, 있으면 `If-Match: "<revision>"`이다.

#### Scenario: 새 글과 불러온 글

- **WHEN** revision null과 `abc`로 헤더를 만든다
- **THEN** 차례로 `If-None-Match: *` · `If-Match: "abc"`다

### Requirement: 저장 실패를 화면이 할 일로 나눈다

web은 SHALL `saveErrorKindOf(error, isNew)`로 저장 실패를 나눈다. 401은 세션 만료, 409는 새 글이면 주소 겹침 · 아니면 충돌, 400은 서버가 거절한 내용, 그 밖(네트워크 · 5xx)은 실패다.

#### Scenario: 401은 세션 만료

- **WHEN** `UnauthorizedError`를 나눈다
- **THEN** 세션 만료다

#### Scenario: 409는 새 글이면 주소 겹침, 아니면 충돌

- **WHEN** 409 `ApiError`를 새 글 · 불러온 글로 각각 나눈다
- **THEN** 차례로 주소 겹침 · 충돌이다

#### Scenario: 그 밖은 실패

- **WHEN** 502 `ApiError`와 네트워크 `TypeError`를 나눈다
- **THEN** 둘 다 실패다

### Requirement: 주소 바꾸기 409는 이유로 나눈다

web은 SHALL `renameErrorKindOf(error)`로 주소 바꾸기 실패를 나눈다. 409의 `reason`이 `stale`이면 충돌 대화상자, `published` · `taken`이면 주소 칸 문장이다.

#### Scenario: 이유별 409

- **WHEN** 409를 이유 stale · published · taken으로 나눈다
- **THEN** 차례로 충돌 · 주소 칸 · 주소 칸이다

### Requirement: 머리줄 저장 문구는 오전 · 오후 시각으로 쓴다

web은 SHALL `saveStatusText(status)`로 머리줄 문구를 만든다. 저장 중은 "저장 중…", 저장됨은 "초안 저장됨, 오후 3시 42분"처럼 12시간 시각, 발행한 글은 "발행됨, …", 실패는 "저장하지 못했어요"다.

#### Scenario: 저장된 시각

- **WHEN** 15:42와 00:05에 저장된 상태의 문구를 만든다
- **THEN** 차례로 "초안 저장됨, 오후 3시 42분" · "초안 저장됨, 오전 12시 5분"이다

### Requirement: 다시 들어왔을 때 브라우저에 남은 글을 되살릴지 정한다

web은 SHALL `restoreDecisionOf(local, serverRevision)`으로 localDraft 처리를 정한다. 남은 글이 없으면 그대로, 남은 글의 기준 revision이 서버 revision과 같으면 되살리기, 다르면 충돌이다.

#### Scenario: 같은 revision 위에서 쓰던 글

- **WHEN** 기준 revision `r1`인 localDraft와 서버 `r1`을 본다
- **THEN** 되살리기다

#### Scenario: 그사이 서버가 바뀌었다

- **WHEN** 기준 revision `r1`인 localDraft와 서버 `r2`를 본다
- **THEN** 충돌이다

#### Scenario: 남은 글이 없다

- **WHEN** localDraft 없이 본다
- **THEN** 그대로다

### Requirement: 되살린 글이 충돌이면 쓰던 글의 기준 revision으로 저장한다

web은 SHALL `editingStartOf`에서 되살리기가 충돌이면 저장 기준 revision을 쓰던 글의 기준 revision으로 둔다 — 덮어쓰기를 고르지 않은 저장(발행 포함)은 409로 다시 충돌 대화상자가 뜬다. 되살리기면 서버 revision이다.

#### Scenario: 그사이 바뀐 글에 충돌로 되살리기

- **WHEN** 서버 r2인 글에 r1 위에서 쓰던 글을 되살린다
- **THEN** 충돌이고 쓰던 제목이 보이며 저장 기준은 r1이다

#### Scenario: 같은 revision 위에서 되살리기

- **WHEN** 서버 r2인 글에 r2 위에서 쓰던 글을 되살린다
- **THEN** 되살리기이고 저장 기준은 r2다

### Requirement: 발행 여부와 쓰던 글은 저장 줄 안에서 곧바로 이어진다

web은 SHALL `createPostSaver`가 주소 · revision · 발행 여부를 닫힌 값으로 가지게 한다. 발행이 성공한 순간 발행 여부가 바뀌어, 그 뒤에 줄 선 초안 저장은 서버에 `draft: true`를 보내지 않는다. 주소를 바꾸면 쓰던 글을 새 주소 키에 먼저 남기고 옛 키를 지운다.

#### Scenario: 발행 뒤에 줄 선 초안 저장

- **WHEN** 발행 저장이 끝난 뒤 줄 서 있던 초안 저장이 돈다
- **THEN** `draft: true`로 PUT하지 않고 발행 글이다

#### Scenario: 주소를 바꾼 뒤 저장이 실패한다

- **WHEN** 주소 바꾸기가 된 뒤 PUT이 실패한다
- **THEN** localDraft가 새 주소 키(기준 revision은 옮긴 revision)에 있고 옛 키는 비었다
