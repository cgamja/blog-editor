## ADDED Requirements

### Requirement: 세션 확인은 세션이 있을 때만 204다

`GET /api/session`은 SHALL 유효한 세션 쿠키가 있으면 본문 없는 204를, 없거나 만료 · 위조면 401과 `message`를 준다. 이 경로는 세션 없이 열리는 메서드(로그인 POST · 로그아웃 DELETE)에 들지 않는다.

#### Scenario: 세션이 있으면 204

- **WHEN** 로그인한 쿠키로 `GET /api/session`을 부른다
- **THEN** 204이고 본문이 비어 있다

#### Scenario: 세션이 없으면 401

- **WHEN** 세션 쿠키 없이 `GET /api/session`을 부른다
- **THEN** 401이고 `message`가 있다
