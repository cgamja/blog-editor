## ADDED Requirements

### Requirement: 인가 서버 위치와 능력을 메타데이터로 알린다

OAuth가 켜진 앱은 SHALL `GET /.well-known/oauth-protected-resource/mcp`(RFC 9728 — `/.well-known/oauth-protected-resource`도 같은 문서)에 `resource: "<발급자>/mcp"` · `authorization_servers: ["<발급자>"]` · `scopes_supported: ["drafts"]`를, `GET /.well-known/oauth-authorization-server`(RFC 8414)에 `issuer` · `authorization_endpoint` · `token_endpoint` · `registration_endpoint` · `response_types_supported: ["code"]` · `grant_types_supported: ["authorization_code","refresh_token"]` · `code_challenge_methods_supported: ["S256"]` · `token_endpoint_auth_methods_supported: ["none"]` · `authorization_response_iss_parameter_supported: true`를 준다. 발급자는 설정 값(`PUBLIC_BASE_URL`) 하나다.

#### Scenario: 두 메타데이터가 서로를 가리킨다

- **WHEN** 발급자 `https://editor.example.test`로 만든 앱에 두 well-known 문서를 부른다
- **THEN** 보호 자원의 `authorization_servers[0]`이 인가 서버의 `issuer`와 같고, 인가 서버는 `S256`과 `none`을 광고한다

### Requirement: 동적 클라이언트 등록은 허용된 redirect_uri만 받는다 (보호 대상)

`POST /register`(RFC 7591, JSON)는 SHALL 모든 `redirect_uris`가 `https://claude.ai/api/mcp/auth_callback`이거나 표준 모양의 루프백 `http://localhost:<포트>/callback` · `http://127.0.0.1:<포트>/callback`일 때만 201과 새 `client_id`(공개 클라이언트, `token_endpoint_auth_method: "none"`)를 준다. 하나라도 목록 밖이면 400 `invalid_redirect_uri`이고 클라이언트를 만들지 않는다. 저장 클라이언트 수에는 상한이 있다 — 꽉 차면 **토큰을 한 번도 받지 않았고 등록한 지 10분이 지난** 클라이언트만 오래된 순으로 버리고, 그런 클라이언트가 없으면 503 `temporarily_unavailable`로 등록을 거부한다. 연결된 클라이언트와 막 등록해 로그인 중인 클라이언트는 밀려나지 않는다.

#### Scenario: claude.ai 콜백으로 등록된다

- **WHEN** `redirect_uris: ["https://claude.ai/api/mcp/auth_callback"]`로 `/register`를 부른다
- **THEN** 201이고 `client_id`가 있으며 `token_endpoint_auth_method`는 `none`이다

#### Scenario: 목록 밖 redirect_uri는 등록되지 않는다

- **WHEN** `redirect_uris: ["https://evil.example/callback"]`로 `/register`를 부른다
- **THEN** 400이고 `error`는 `invalid_redirect_uri`다

#### Scenario: 꽉 차면 토큰을 받지 않은 클라이언트부터 밀려난다

- **WHEN** 상한 2에서 A를 등록해 토큰까지 받고, B를 등록한 뒤 10분이 지나 C를 등록한다
- **THEN** C는 201이고, B의 `/authorize`는 400(없는 클라이언트)이며, A의 액세스 토큰은 그대로 `/mcp`를 연다

#### Scenario: 막 등록한 클라이언트는 밀려나지 않는다

- **WHEN** 상한 2에서 A를 등록해 토큰까지 받고, B를 등록한 직후 C를 등록한다
- **THEN** C는 503이고 B의 `/authorize`는 그대로 코드를 준다

#### Scenario: 모두 연결된 클라이언트면 등록을 거부한다

- **WHEN** 상한 1에서 A를 등록해 토큰까지 받은 뒤 B를 등록한다
- **THEN** 503이고 `error`는 `temporarily_unavailable`이다

실패 의미론: 등록 · 클라이언트는 메모리에 있다 — 재시작하면 claude.ai가 다시 등록한다. 영속 저장은 M4. 등록 폭주 중에는 새 연결이 503일 수 있다(연결된 클라이언트는 안전).
