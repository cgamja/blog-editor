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
