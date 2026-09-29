# Spec Delta — site-rebuild

## ADDED Requirements

### Requirement: 사이트에 보이는 글이 바뀌면 재빌드를 요청한다

API는 SHALL `PUT /api/posts/:slug`가 성공했고 저장 전이나 저장 뒤 중 하나라도 발행 상태면(발행 · 발행 취소 · 발행 글 수정) 사이트 재빌드를 요청한다. 초안끼리의 저장은 요청하지 않는다. `SITE_BUILD_HOOK_URL`이 없으면 요청하지 않는다. 재빌드 실패는 저장 응답을 바꾸지 않는다. MCP는 발행 글을 쓰지 못하므로 이 경로는 사람의 저장뿐이다.

#### Scenario: 발행하면 요청한다

- **WHEN** 초안을 `draft: false`로 저장한다
- **THEN** 저장은 200이고 재빌드가 요청된다

#### Scenario: 초안 저장은 요청하지 않는다

- **WHEN** 초안을 `draft: true`로 다시 저장한다
- **THEN** 재빌드 요청이 없다

#### Scenario: 발행 취소도 요청한다

- **WHEN** 발행 글을 `draft: true`로 저장한다
- **THEN** 재빌드가 요청된다

### Requirement: 연속 요청은 30초 묶어 한 번 보낸다

API는 SHALL 재빌드 요청을 받으면 상태를 `pending`으로 두고 30초 뒤 그동안 마지막 요청만 `SITE_BUILD_HOOK_URL`에 POST한다. 2xx면 `sent`, 그 밖의 상태 · 네트워크 오류 · 10초 초과면 `failed`다.

#### Scenario: 세 번 발행해도 훅은 한 번이다

- **WHEN** 10초 간격으로 세 번 요청한다
- **THEN** 마지막 요청 30초 뒤 훅 POST가 한 번이고 상태는 `sent`다

#### Scenario: 훅이 실패하면 실패로 남는다

- **WHEN** 훅이 500을 준다
- **THEN** 상태는 `failed`다

#### Scenario: 끝나지 않은 대기는 1분 뒤 실패로 본다

- **WHEN** `pending`으로 기록된 뒤 1분이 넘도록 결과가 없다(함수 인스턴스가 먼저 내려감)
- **THEN** 상태를 읽으면 `failed`다

### Requirement: 편집 화면이 실패를 알리고 다시 시도할 수 있다

API는 SHALL `GET /api/site-rebuild`로 상태(`off` · `idle` · `pending` · `sent` · `failed`)를 주고, `POST /api/site-rebuild`는 묶지 않고 바로 훅을 불러 결과 상태를 준다. 둘 다 로그인이 필요하다. 편집 화면은 SHALL 상태가 `failed`면 "사이트 반영 실패"와 "다시 시도" 버튼을 보여 주고, 발행 관련 저장 뒤 `pending`인 동안 상태를 다시 읽는다.

#### Scenario: 실패하면 배너가 뜬다

- **WHEN** 발행 뒤 상태가 `failed`가 된다
- **THEN** 편집 화면에 "사이트 반영 실패"와 "다시 시도"가 보인다

#### Scenario: 다시 시도가 성공하면 배너가 사라진다

- **WHEN** "다시 시도"를 누르고 훅이 2xx를 준다
- **THEN** 배너가 사라진다

#### Scenario: 로그인 없이는 볼 수 없다

- **WHEN** 세션 없이 `GET /api/site-rebuild`를 부른다
- **THEN** 401이다
