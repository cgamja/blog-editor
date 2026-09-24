# ADR-018. MCP OAuth 인가 서버를 같은 서비스에 직접 구현한다 — DCR · PKCE S256 · 메모리 상태 · 로그인 잠금

- 날짜: 2026-09-24
- 상태: 승인됨
- 원천: adr-007(초안만 · OAuth 또는 연결용 토큰) · adr-016(연결용 토큰 · "OAuth는 다음 change" · 재검토 조건) · D8(로그인 방어) · 이슈 #36 · #33
- 근거 문서(2026-09-24 확인): claude.com/docs/connectors/building/authentication · modelcontextprotocol.io/specification/draft/basic/authorization · RFC 8414 · 9728 · 7591 · 7636 · 8707 · 9207 · 8252

## 문제 (맥락)

claude.ai 웹 커스텀 커넥터는 고정 Bearer 헤더(`static_headers`)가 베타 · 일부 계정뿐이라, 그 칸이 없는 계정은 OAuth로만 붙는다. claude.ai가 요구하는 것: 401의 `WWW-Authenticate`에 `resource_metadata`(RFC 9728), 인가 서버 메타데이터(RFC 8414), 클라이언트 등록(DCR 또는 CIMD), 모든 요청에 PKCE S256, `/token`은 form-urlencoded · 공개 클라이언트 refresh 회전, 발견 · 등록 · 토큰 응답 10초 이내. 계정은 1개이고 사용자는 짧은 비밀번호(`admin` / `1234`)를 원하는데, claude.ai에 붙이려면 터널로 로그인 화면이 인터넷에 나간다.

## 결정

- **같은 서비스(`apps/editor/api`)가 인가 서버가 된다.** 발급자 = `PUBLIC_BASE_URL`(경로 없는 origin), MCP URL = `<발급자>/mcp`. 새 의존성 없이 `node:crypto` · Hono 내장으로 메타데이터 · `/register` · `/authorize`(로그인 + 동의 한 폼) · `/token`을 둔다.
- **클라이언트 등록은 DCR**(RFC 7591). redirect_uri는 claude.ai 콜백과 표준 모양 루프백 `/callback`(포트 무시)만. 클라이언트 상한 100 — 꽉 차면 토큰을 받은 적 없는 것만 오래된 순으로 버리고, 없으면 503.
- **토큰은 불투명 무작위값 + SHA-256 저장**, 대상(RFC 8707)을 박아 `/mcp`가 확인한다. 범위는 `drafts` 하나, 권한은 연결용 토큰과 같다(초안만 — adr-007). code 5분 1회용, 액세스 1시간, refresh 30일 회전.
- **상태는 메모리**(`OAuthStore` 계약 + 메모리 구현). 영속은 M4.
- **로그인 잠금 카운터**를 `authenticate()` 한 곳에 둔다 — 계정별 연속 5회 실패 → 15분 잠금, 잠긴 동안 맞는 비밀번호도 같은 실패, 없는 아이디는 한 묶음. `/api/session`과 `POST /authorize`가 같이 쓴다. D8 재검토 조건("기억하기 쉬운 비밀번호를 쓸 거면 … 5회 실패 → 15분 잠금")의 로컬 몫이다.

## 버린 대안

- **SDK v2의 인가 도우미로 조립**: `@modelcontextprotocol/server` 2.0.0이 내보내는 것은 **자원 서버 쪽뿐**이다 — `requireBearerAuth` · `verifyBearerToken` · `bearerAuthChallengeResponse`(Bearer 확인 · 401/403 응답), `oauthMetadataResponse` · `buildOAuthProtectedResourceMetadata` · `getOAuthProtectedResourceMetadataUrl`(well-known 문서). 인가 서버(authorize · token · register) 라우터는 없다(`index.d.mts` export 목록 확인). 쓰지 않은 이유: ① `requireBearerAuth`는 `AuthInfo.expiresAt`이 없는 토큰을 거부한다 — 연결용 토큰(만료 없음)에 가짜 만료를 박아야 한다. ② 401 본문이 OAuth 오류 JSON으로 고정돼 AI가 읽는 한국어 안내(`MCP_UNAUTHORIZED_MESSAGE`)를 못 싣는다. ③ `oauthMetadataResponse`는 인가 서버 메타데이터를 그대로 넘겨 주고 permissive CORS를 붙일 뿐이라, 어차피 손으로 쓰는 문서 두 개를 줄여 주지 않는다. 인가 서버를 직접 쓰는 이상 자원 서버 쪽 몇 줄도 같은 코드에 두는 편이 읽기 쉽다.
- **외부 IdP(Cognito · Auth0 등)**: 계정 1개에 사용자 풀 · 앱 클라이언트 · 도메인 · 비용이 따라오고, 동의 화면 · redirect 허용 목록 · 토큰 대상 검증을 IdP 설정으로 옮겨야 한다. claude.ai의 DCR/CIMD 요구를 IdP가 채우는지 계정별로 확인해야 하고(Cognito는 DCR 없음), 로컬 우선(D12)에서 로컬 끝에서 끝까지가 깨진다.
- **CIMD**: MCP 스펙 draft는 CIMD를 SHOULD로 둔다. 하지만 인가 서버가 `client_id` URL을 바깥으로 가져와야 한다 — SSRF 방어 · 캐시 · Lambda egress가 따라온다. claude.ai는 메타데이터에 CIMD 두 값이 없으면 DCR로 간다. 본인용이라 DCR의 단점(연결마다 클라이언트)이 문제되지 않는다.
- **refresh 없이 긴 액세스 토큰**: claude.ai는 401에 반응해 refresh하고, OAuth 2.1은 공개 클라이언트 refresh 회전을 요구한다. 새면 오래 가는 토큰을 만들 이유가 없다.

## 감수한 트레이드오프

- **보안 코드를 직접 쓴다** — PKCE · redirect 비교 · 코드 1회성 · 회전 · 대상 검증 · 동의 화면 CSRF를 우리가 책임진다. 보호 대상 테스트(mcp-oauth-grant · mcp-oauth-server)가 받친다.
- **메모리 상태**: 재시작하면 모든 클라이언트 · 토큰 · 잠금 카운터가 사라진다. claude.ai는 401 → refresh 실패 → 다시 연결로 복구한다. 사람이 다시 동의해야 한다.
- **잠금은 서비스 거부를 허용한다**: 누구나 5번 틀려 주인을 15분 막을 수 있다. 본인용 1단계에서 받아들인다. 방어의 중심은 여전히 비밀번호 길이다(D8) — 문서가 터널을 열 때 긴 비밀번호를 권한다.
- **DCR은 등록을 인증 없이 연다**: 상한 · 연결된 클라이언트 보호 · 503으로 막지만, 등록 폭주 중에는 새 연결이 막힐 수 있다.

## ADR-016 재검토 조건에 대한 답

adr-016은 "OAuth change에서 SDK의 인가 도우미가 무상태 모델과 안 맞을 때"를 재검토 조건으로 두었다. 답: 도우미(`requireBearerAuth` 등)는 무상태 fetch 모델과 **맞는다** — 맞지 않는 것은 연결용 토큰(만료 없음)과 응답 본문 쪽이다. 그래서 SDK의 무상태 핸들러(adr-016)는 그대로 두고, 인가만 우리가 쓴다. adr-016의 결정은 바뀌지 않는다.

## 재검토 조건

- claude.ai가 DCR을 그만두거나 CIMD만 받게 될 때, 또는 바깥 요청(egress)을 안전하게 둘 수 있게 됐을 때 → CIMD.
- 2단계 외부 사용자(계정 여럿)를 열 때 → 외부 IdP 또는 계정별 잠금 · 스로틀 재설계.
- M4 배포 → OAuth 상태 · 잠금 카운터 영속(DynamoDB 등, #33), `/register` · `/token` 라우트 스로틀.
- SDK가 인가 서버 쪽 도우미(무상태 · Hono에서 도는)를 내보낼 때.
