## ADDED Requirements

### Requirement: 미리보기 요청 본문은 markdown 하나뿐이다

`POST /api/import/preview`는 SHALL 본문에 `markdown` 밖의 키가 있으면 400을 돌려준다(계약 `additionalProperties: false`).

#### Scenario: 모르는 키가 든 본문은 400이다

- **WHEN** markdown 밖의 키가 든 본문으로 부른다
- **THEN** 400이다
