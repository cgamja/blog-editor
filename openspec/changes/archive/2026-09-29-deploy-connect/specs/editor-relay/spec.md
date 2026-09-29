# Spec Delta — editor-relay

## ADDED Requirements

### Requirement: 에디터 주소 하나가 화면과 API를 같이 낸다

중계는 SHALL API 경로(`/api/*` · `/public/*` · `/images/*` · `/mcp` · `/authorize` · `/register` · `/token` · `/.well-known/*`)를 Supabase 함수 주소 뒤에 같은 경로 · 쿼리로 붙여 방법 · 본문 · 헤더째 넘기고, 받은 상태 · 헤더(`Set-Cookie` 포함) · 본문을 그대로 돌려준다. 리다이렉트는 따라가지 않는다. 그 밖의 경로는 화면 파일이고, 없는 경로는 `index.html`이다.

#### Scenario: API 요청이 함수로 간다

- **WHEN** `PUT /api/posts/a?x=1`을 본문 · `If-Match`와 함께 보낸다
- **THEN** 함수 주소 `…/api/posts/a?x=1`로 같은 방법 · 본문 · `If-Match`가 가고, 함수의 상태 · `Set-Cookie` · 본문이 그대로 돌아온다

#### Scenario: 함수에 닿지 못하면 502 JSON이다

- **WHEN** 함수 호출이 네트워크 오류로 실패한다
- **THEN** 502와 `{ message }` JSON이다

#### Scenario: 리다이렉트는 그대로 돌려준다

- **WHEN** 함수가 302와 `Location`을 준다
- **THEN** 중계도 302와 같은 `Location`이다

### Requirement: OAuth 로그인 화면은 HTML로 돌려준다

중계는 SHALL `GET /authorize` 응답의 Content-Type이 `text/plain`이면 `text/html; charset=utf-8`로 바꾼다. 다른 경로 · 방법의 Content-Type은 바꾸지 않는다(무료 Supabase는 GET의 HTML만 바꾼다).

#### Scenario: 로그인 화면이 HTML이다

- **WHEN** 함수가 `GET /authorize`에 `text/plain`으로 답한다
- **THEN** 중계 응답은 `text/html; charset=utf-8`이다

#### Scenario: 다른 경로는 건드리지 않는다

- **WHEN** 함수가 `GET /public/posts`에 `text/plain`으로 답한다
- **THEN** 중계 응답도 `text/plain`이다

### Requirement: 함수는 중계를 거친 요청만 받는다 (보호 대상)

중계는 SHALL 함수로 보내는 모든 요청에 `X-Relay-Secret`(Worker 시크릿 `RELAY_SECRET`)을 붙이고, 들어온 요청의 같은 이름 헤더는 버린다. 함수는 이 값이 함수 시크릿 `RELAY_SECRET`과 다르거나 없으면 앱에 넘기지 않고 403이다. `RELAY_SECRET`이 없으면 함수가 뜨지 않는다.

#### Scenario: 함수 주소를 바로 부르면 거부된다

- **WHEN** `X-Relay-Secret` 없이 함수의 `GET /public/posts`를 부른다
- **THEN** 403이다

#### Scenario: 밖에서 넣은 헤더는 버린다

- **WHEN** 브라우저가 `X-Relay-Secret: guess`를 붙여 중계에 요청한다
- **THEN** 함수에는 Worker 시크릿 값이 간다

### Requirement: 로그인 경로는 IP당 요청량을 자른다

중계는 SHALL `POST /api/session` · `POST /authorize`를 접속 IP(`CF-Connecting-IP`)마다 분당 10회까지만 함수로 넘기고, 넘으면 함수를 부르지 않고 429와 `Retry-After: 60`을 준다. 다른 경로 · 방법은 세지 않는다.

#### Scenario: 11번째 로그인은 함수에 가지 않는다

- **WHEN** 한 IP가 1분 안에 `POST /api/session`을 11번 보낸다
- **THEN** 11번째는 429이고 함수 호출은 10번이다
