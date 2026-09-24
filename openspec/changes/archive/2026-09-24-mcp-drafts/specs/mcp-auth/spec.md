## ADDED Requirements

### Requirement: /mcp는 연결용 토큰이 있어야 한다 (보호 대상)

`/mcp`는 SHALL `Authorization: Bearer <토큰>`의 SHA-256이 연결용 토큰 저장소에 있을 때만 MCP 요청을 처리한다. 헤더가 없거나 토큰이 틀리면 401과 `WWW-Authenticate: Bearer`를 주고 도구를 실행하지 않는다. 저장소는 토큰 원문을 갖지 않는다. 연결용 토큰이 설정되지 않은 앱에는 `/mcp`가 없다(404).

#### Scenario: 토큰 없이 부르면 401이다

- **WHEN** `Authorization` 없이 `/mcp`에 `tools/list`를 보낸다
- **THEN** 401이고 `WWW-Authenticate`가 `Bearer`로 시작한다

#### Scenario: 틀린 토큰은 401이다

- **WHEN** 저장소에 없는 토큰으로 `/mcp`에 `tools/list`를 보낸다
- **THEN** 401이다

#### Scenario: 연결용 토큰 설정이 없는 앱에는 /mcp가 없다

- **WHEN** 연결용 토큰 설정 없이 만든 앱에 `/mcp`를 부른다
- **THEN** 404다

#### Scenario: 세션과 연결용 토큰은 서로의 문을 열지 못한다

- **WHEN** 로그인한 세션 쿠키만으로 `/mcp`를 부르고, 연결용 토큰만으로 `GET /api/posts`를 부른다
- **THEN** 둘 다 401이다

실패 의미론: 토큰은 워크스페이스에 하나씩 공유되는 비밀이다. 새면 초안을 쓸 수 있지만 발행 · 삭제는 못 한다(mcp-drafts 보호 대상). 폐기는 env 교체.
