# Design — mcp-oauth

근거 문서(2026-09-24 확인): claude.com/docs/connectors/building/authentication · modelcontextprotocol.io/specification/draft/basic/authorization · RFC 8414 · 9728 · 7591 · 7636 · 8707 · 9207 · 8252.

## 1. 클라이언트 등록은 DCR이다 (CIMD는 다음)

claude.ai는 인가 서버 메타데이터에 `client_id_metadata_document_supported: true`와 `token_endpoint_auth_methods_supported`의 `none`이 **둘 다** 있을 때만 CIMD를 쓰고, 아니면 DCR(`registration_endpoint`)로 간다. MCP 스펙 draft는 CIMD를 SHOULD, DCR을 하위 호환용 MAY로 둔다. 그래도 DCR을 고른다:

- CIMD는 인가 서버가 `client_id` URL을 **바깥으로 가져와야** 한다 — SSRF 방어 · 캐시 · Lambda egress가 따라온다. DCR은 들어오는 JSON 하나다.
- 계정 1개 본인용이라 "연결마다 클라이언트가 새로 생긴다"(DCR의 단점)가 문제되지 않는다. 대신 메모리 저장소에 상한(100)을 둔다 — 등록은 인증 없이 열려 있다. 꽉 차면 **토큰을 받은 적 없고 등록한 지 10분(`UNCONNECTED_CLIENT_GRACE_SECONDS`)이 지난** 클라이언트만 오래된 순으로 버리고, 없으면 503으로 거부한다 — 유예가 없으면 사람이 로그인하는 사이에 막 등록한 claude.ai가 밀려날 수 있다. 오래된 것부터 무조건 버리면 등록 폭주로 연결된 claude.ai를 밀어낼 수 있다(리뷰 반영).
- 등록은 누구나 할 수 있어도 **redirect_uri 허용 목록**이 코드가 갈 곳을 묶는다.

## 2. redirect_uri 허용 목록

`https://claude.ai/api/mcp/auth_callback` 그대로, 또는 표준 모양(`new URL(uri).href === uri` — `127.1` · `0x7f000001` · 전각 숫자 거부)의 루프백 `http://localhost:<포트>/callback` · `http://127.0.0.1:<포트>/callback`(Claude Code — RFC 8252 7.3, 포트는 비교하지 않는다). 등록 때 목록 밖이면 거부하고, `/authorize`에서는 그 클라이언트가 등록한 URI와 비교한다(루프백만 포트 무시). 동의 화면의 제목은 고정 문구이고 가장 크게 보이는 것은 **돌아갈 곳의 호스트**다. `client_name`은 등록한 쪽이 마음대로 적으므로 "앱이 밝힌 이름(확인되지 않음)"으로 보조 표시만 한다(피싱 완화). 루프백이면 경고 문장을 붙인다(MCP 스펙 localhost 위험).

## 3. /authorize — 로그인과 동의를 한 폼으로, CSRF는 SameSite=Strict + Origin

- 세션 쿠키는 `SameSite=Strict`라 claude.ai에서 넘어온 **첫 탐색에는 실리지 않는다**. 그래서 화면은 "세션이 보이면 동의만, 아니면 아이디 · 비밀번호 + 동의" 한 폼이다. 로그인 확인은 `/api/session`과 같은 함수(없는 계정도 scrypt · 실패 지연)를 쓴다.
- 요청 값(client_id · redirect_uri · state · code_challenge · resource · scope)은 서버에 저장하지 않고 폼 hidden으로 되돌려 받아 **POST에서 전부 다시 검증**한다(무상태).
- CSRF: 동의만 하는 길은 세션 쿠키에 기대는데, 다른 사이트에서 보낸 POST에는 Strict 쿠키가 실리지 않는다. 비밀번호 길은 비밀번호가 곧 증명이다. 덧붙여 POST의 `Origin`이 있으면 발급자 origin과 같아야 한다. 화면은 `frame-ancestors 'none'` · `X-Frame-Options: DENY`(클릭재킹).

## 4. 토큰

- code · 액세스 · refresh 모두 32바이트 무작위(base64url), 저장은 SHA-256만(연결용 토큰과 같은 이유 — adr-016).
- 수명: code 5분(1회용) · 액세스 1시간 · refresh 30일. refresh는 쓸 때마다 새로 주고 옛 refresh와 그와 함께 나간 액세스 토큰을 지운다(OAuth 2.1 공개 클라이언트 회전). 저장소는 찾기 · 꺼내기에서 만료 항목을 지운다.
- `resource`(RFC 8707)가 오면 MCP URL(`<issuer>/mcp`)과 같아야 한다. 토큰에 대상이 박히고 `/mcp`가 확인한다. 범위는 `drafts` 하나.
- 인가 응답에 `iss`(RFC 9207)를 싣고 메타데이터에 `authorization_response_iss_parameter_supported: true`.

## 5. 초안 출처

`postSourceSchema`는 `editor | claude | chatgpt | token:<[a-z0-9-]{1,32}>`만 받는다. 스키마를 바꾸지 않고 OAuth 초안은 `token:oauth-claude-ai`(claude.ai 콜백) · `token:oauth-loopback`(루프백)으로 적는다 — 연결용 토큰(`token:<이름>`)과 구분된다.

## 6. 저장소

`OAuthStore` 계약 + 메모리 구현. 재시작하면 클라이언트 · 토큰이 날아가고 claude.ai는 401 → 다시 연결로 복구한다. 영속(DynamoDB 등)은 M4.

## 7. 로그인 잠금 (리뷰 반영 — D8 재검토 조건)

사용자는 짧은 비밀번호(`admin` / `1234`)를 쓰고, claude.ai에 붙이려면 터널로 로그인 화면이 인터넷에 나간다. 요청마다 두는 1초 지연은 병렬 요청에 소용이 없다. 그래서 `authenticate()` 한 곳(`/api/session` · `POST /authorize` 공용)에 메모리 잠금 카운터를 둔다: 계정별 연속 5회 실패 → 15분 잠금, 잠긴 동안은 맞는 비밀번호도 같은 실패 응답, 없는 아이디는 한 묶음. 비용: 아이디를 아는 사람은 5번 틀려 주인을 15분씩 거듭 막을 수 있다(서비스 거부) — 본인용 1단계에서 받아들이고, 문서가 추측하기 어려운 아이디와 긴 비밀번호를 권한다. 재시작하면 초기화, 영속 카운터(DynamoDB)는 M4(#33). 문서는 터널을 열 때 긴 비밀번호를 권한다.

## 8. 후속 (이번에 하지 않는다)

- 재사용된 refresh · code를 감지하면 그 토큰 계열 전체를 폐기(OAuth 2.1 권고). 지금은 재사용이 `invalid_grant`로 끝난다.
- 동시 refresh 재시도 허용 창(네트워크 재시도가 방금 회전된 refresh로 다시 오는 경우) — 지금은 두 번째가 `invalid_grant`라 claude.ai가 다시 연결해야 한다.
- CIMD · 영속 저장 · `/register` · `/token` 스로틀(M4).
