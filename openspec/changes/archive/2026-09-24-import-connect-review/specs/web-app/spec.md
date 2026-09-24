## MODIFIED Requirements

### Requirement: API 요청 도우미는 401과 그 밖의 실패를 오류로 나눈다

web은 SHALL 화면의 API 요청을 `apiRequest(path, init)`로 보낸다. 401은 `UnauthorizedError`, 409는 `ConflictError`(둘 다 `ApiError`), 그 밖의 실패는 상태 코드와 본문 `message`(없으면 null)를 가진 `ApiError`로 던지고, 2xx는 응답을 그대로 돌려준다. 화면은 409를 `instanceof ConflictError`로 가른다(.claude/rules/state.md).

#### Scenario: 401은 UnauthorizedError

- **WHEN** 401을 받는다
- **THEN** `UnauthorizedError`다

#### Scenario: 문장이 든 실패는 그 문장을 가진 ApiError

- **WHEN** `message`가 든 JSON 409를 받는다
- **THEN** 상태 409와 그 문장을 가진 `ApiError`다

#### Scenario: JSON이 아닌 실패는 문장 없는 ApiError

- **WHEN** 본문이 JSON이 아닌 502를 받는다
- **THEN** 상태 502, 문장 null인 `ApiError`다

#### Scenario: 2xx는 응답 그대로

- **WHEN** 204를 받는다
- **THEN** 그 응답을 돌려준다

#### Scenario: 409는 ConflictError

- **WHEN** 409를 받는다
- **THEN** `ConflictError`다
