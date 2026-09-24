## ADDED Requirements

### Requirement: 글 목록 응답은 항목마다 모양을 확인한다

web은 SHALL 글 목록 응답을 받으면 `posts` 배열의 항목마다 필드 형을 확인하고, 틀리면 몇 번째 항목의 어느 필드인지 말하는 오류를 던진다. 목록 한 줄의 키는 계약(`api/openapi.json` PostList)의 항목 속성 · 필수와 같다.

#### Scenario: 맞는 응답은 그대로

- **WHEN** 필드가 모두 맞는 두 항목의 응답을 확인한다
- **THEN** 두 항목이다

#### Scenario: 형이 틀린 항목은 위치와 필드를 말한다

- **WHEN** 두 번째 항목의 `draft`가 문자열인 응답을 확인한다
- **THEN** `posts[1].draft`를 말하는 오류다

#### Scenario: 목록 한 줄의 키는 계약과 같다

- **WHEN** web의 필수 · 선택 키를 계약 PostList 항목의 `properties` · `required`와 견준다
- **THEN** 같다
