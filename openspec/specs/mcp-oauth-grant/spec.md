# mcp-oauth-grant Specification

## Purpose

MCP OAuth 인가 흐름 — 사람 로그인과 동의를 거친 authorization code(PKCE S256) 발급, 토큰 교환과 refresh 회전. 권한은 초안 읽기 · 쓰기뿐이고 열린 리다이렉트를 허용하지 않는다(adr-018).

## Requirements

### Requirement: 사람이 로그인하고 허용해야 인가 코드가 나온다 (보호 대상)

`/authorize`는 SHALL 등록된 `client_id` · 그 클라이언트의 `redirect_uri`(루프백은 포트 무시) · `response_type=code` · `code_challenge`(S256)가 맞을 때만 로그인 · 동의 화면을 보인다. `POST /authorize`는 요청 값을 전부 다시 검증하고, 유효한 세션 쿠키 또는 맞는 아이디 · 비밀번호(`/api/session`과 같은 확인)가 있고 "허용"일 때만 5분짜리 1회용 코드를 `redirect_uri?code=…&state=…&iss=<발급자>`로 보낸다. 거부면 `error=access_denied`다. `client_id`나 `redirect_uri`가 틀리면 리다이렉트하지 않고 400 화면이다. POST의 `Origin`이 있고 발급자 origin과 다르면 403이다.

#### Scenario: 로그인하고 허용하면 코드가 state · iss와 함께 돌아간다

- **WHEN** 등록된 클라이언트의 요청으로 아이디 · 비밀번호와 "허용"을 `POST /authorize`한다
- **THEN** 302 `Location`이 등록한 redirect_uri이고 `code` · 보낸 `state` · `iss=<발급자>`가 있다

#### Scenario: 세션도 비밀번호도 없으면 코드가 나오지 않는다

- **WHEN** 세션 쿠키 없이 틀린 비밀번호로 "허용"을 `POST /authorize`한다
- **THEN** 401 화면이고 `Location`이 없다

#### Scenario: PKCE 없는 요청에는 코드가 나오지 않는다

- **WHEN** `code_challenge` 없이 로그인 · "허용"을 `POST /authorize`한다
- **THEN** redirect_uri로 `error=invalid_request`가 가고 `code`는 없다

#### Scenario: 거부하면 access_denied다

- **WHEN** 로그인하고 "거부"를 `POST /authorize`한다
- **THEN** redirect_uri로 `error=access_denied`가 가고 `code`는 없다

#### Scenario: 다른 사이트에서 보낸 동의는 막힌다

- **WHEN** `Origin: https://evil.example`로 세션 쿠키와 "허용"을 `POST /authorize`한다
- **THEN** 403이고 `Location`이 없다

#### Scenario: 세션 쿠키만으로도 허용할 수 있다

- **WHEN** 로그인한 세션 쿠키로 아이디 · 비밀번호 없이 "허용"을 `POST /authorize`한다
- **THEN** 302이고 `Location`에 `code`가 있다

#### Scenario: 다른 클라이언트의 redirect_uri로는 가지 않는다

- **WHEN** claude.ai 콜백으로 등록한 클라이언트의 `client_id`에 루프백 redirect_uri를 붙여 로그인 · "허용"한다
- **THEN** 400이고 `Location`이 없다

#### Scenario: 루프백은 포트가 달라도 같은 클라이언트다

- **WHEN** `http://127.0.0.1:5555/callback`으로 등록하고 `http://127.0.0.1:6666/callback`으로 로그인 · "허용"한다
- **THEN** 302 `Location`이 `http://127.0.0.1:6666/callback`이고 `code`가 있다

### Requirement: /token은 PKCE를 확인하고 refresh를 돌린다 (보호 대상)

`POST /token`(form-urlencoded)은 SHALL `authorization_code`면 코드 · `client_id` · `redirect_uri`가 발급 때와 같고 `code_verifier`의 S256이 `code_challenge`와 같을 때만 1시간 액세스 토큰과 30일 refresh 토큰을 준다. 코드는 한 번 쓰면 사라진다. `refresh_token`이면 새 액세스 · refresh 토큰을 주고 쓴 refresh는 지운다. 틀리면 400 `invalid_grant`이고 응답은 `Cache-Control: no-store`다.

#### Scenario: 틀린 code_verifier는 invalid_grant다

- **WHEN** 받은 코드를 다른 `code_verifier`로 `/token`에 낸다
- **THEN** 400이고 `error`는 `invalid_grant`다

#### Scenario: 다른 client_id로는 코드를 바꾸지 못한다

- **WHEN** A가 받은 코드를 B의 `client_id`로 `/token`에 낸다
- **THEN** 400이고 `error`는 `invalid_grant`다

#### Scenario: redirect_uri가 글자 하나라도 다르면 바꾸지 못한다

- **WHEN** 받은 코드를 redirect_uri 끝에 `/`를 붙여 `/token`에 낸다
- **THEN** 400이고 `error`는 `invalid_grant`다

#### Scenario: 코드는 두 번 쓰지 못한다

- **WHEN** 한 번 교환한 코드를 같은 값으로 다시 `/token`에 낸다
- **THEN** 두 번째는 400 `invalid_grant`다

#### Scenario: refresh는 돌고 옛 refresh는 죽는다

- **WHEN** refresh 토큰으로 `/token`을 부르고, 같은 옛 refresh로 한 번 더 부른다
- **THEN** 첫 번째는 새 access · refresh를 주고, 두 번째는 400 `invalid_grant`다

실패 의미론: 코드 · 토큰은 메모리에 있다. 재시작하면 claude.ai는 401 → refresh 실패 → 다시 연결로 복구한다.
