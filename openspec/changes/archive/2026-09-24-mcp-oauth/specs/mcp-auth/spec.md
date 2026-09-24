## MODIFIED Requirements

### Requirement: /mcp는 연결용 토큰이 있어야 한다 (보호 대상)

`/mcp`는 SHALL `Authorization: Bearer <토큰>`의 SHA-256이 연결용 토큰 저장소에 있거나 유효한 OAuth 액세스 토큰(mcp-oauth-grant)일 때만 MCP 요청을 처리한다. 헤더가 없거나 토큰이 틀리면 401과 `WWW-Authenticate: Bearer`를 주고 도구를 실행하지 않는다. OAuth가 켜져 있으면 그 헤더에 `resource_metadata="<발급자>/.well-known/oauth-protected-resource/mcp"`와 `scope="drafts"`를 싣는다. 저장소는 토큰 원문을 갖지 않는다. 연결용 토큰 설정이 없는 앱에는 `/mcp`가 없다(404).

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

#### Scenario: OAuth가 켜진 앱의 401은 메타데이터 위치를 알린다

- **WHEN** OAuth를 켠 앱에 토큰 없이 `/mcp`를 부른다
- **THEN** 401이고 `WWW-Authenticate`에 `resource_metadata="<발급자>/.well-known/oauth-protected-resource/mcp"`가 있다

실패 의미론: 토큰은 워크스페이스에 하나씩 공유되는 비밀이다. 새면 초안을 쓸 수 있지만 발행 · 삭제는 못 한다(mcp-drafts 보호 대상). 폐기는 env 교체.

## ADDED Requirements

### Requirement: OAuth 액세스 토큰도 초안 권한만 연다 (보호 대상)

OAuth 액세스 토큰은 SHALL 연결용 토큰과 같은 도구 · 같은 초안 규칙(mcp-drafts)만 쓴다. 쓴 초안의 출처는 claude.ai 콜백으로 받은 토큰이면 `token:oauth-claude-ai`, 루프백이면 `token:oauth-loopback`이다. 만료됐거나 이 서버의 MCP URL 말고 다른 대상으로 발급된 토큰은 401이다.

#### Scenario: OAuth 토큰으로 쓴 초안도 초안이다

- **WHEN** claude.ai 콜백으로 받은 OAuth 액세스 토큰으로 `tools/list`와 `create_draft`를 부른다
- **THEN** 도구 목록에 발행 도구가 없고, 저장된 글은 `draft: true` · `source: "token:oauth-claude-ai"`다

#### Scenario: refresh로 회전된 옛 액세스 토큰은 401이다

- **WHEN** refresh로 새 토큰을 받은 뒤 옛 액세스 토큰으로 `/mcp`를 부른다
- **THEN** 401이다

#### Scenario: 만료된 OAuth 토큰은 401이다

- **WHEN** 액세스 토큰 수명이 지난 뒤 그 토큰으로 `/mcp`를 부른다
- **THEN** 401이다

실패 의미론: OAuth 상태는 메모리에 있어 서버를 다시 시작하면 모든 토큰이 무효다 — 클라이언트는 401을 받고 다시 연결한다.
