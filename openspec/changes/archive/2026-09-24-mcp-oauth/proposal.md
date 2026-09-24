# mcp-oauth (이슈 #36)

## Why

PR #35로 `/mcp`는 연결용 토큰(Bearer)으로 열렸다. Claude Code는 그 헤더로 붙지만, claude.ai 웹 커스텀 커넥터의 "Request headers"(`static_headers`)는 베타라 일부 계정에만 있다. 그 칸이 없으면 claude.ai는 OAuth로만 붙는다(claude.com/docs/connectors/building/authentication · adr-016 설계 메모).

## What Changes

- 같은 서비스가 인가 서버가 된다: protected resource metadata(RFC 9728) · 인가 서버 메타데이터(RFC 8414) · 동적 클라이언트 등록(RFC 7591) · `/authorize`(사람 로그인 + 동의) · `/token`(PKCE S256 · refresh 회전)
- `/mcp`는 연결용 토큰 **또는** OAuth 액세스 토큰을 받는다. 권한은 같다 — 초안 읽기 · 쓰기뿐(adr-007)
- OAuth가 켜져 있으면 401의 `WWW-Authenticate`에 `resource_metadata`를 싣는다
- 로컬 진입점: `PUBLIC_BASE_URL`이 있으면 OAuth를 연다(터널 주소 또는 `http://127.0.0.1:8787`)
- 로그인 잠금 카운터(연속 5회 실패 → 15분) — 터널로 로그인 화면이 인터넷에 나가므로(api-session delta, D8 재검토 조건)

## Impact

- 새 의존성 없음 — `node:crypto` · Hono 내장
- `apps/editor/api/src/mcp/oauth/*`(새 폴더) · `mcp/route.ts` · `mcp/env.ts` · `session.ts`(로그인 확인을 함수로 뺀다) · `login-lockout.ts` · `serve.ts` · `docs/mcp-connect.md` · adr-018
- 하지 않는 것: CIMD(다음 — 인가 서버가 바깥으로 메타데이터를 가져오는 요청이 생긴다), OAuth 상태 영속 저장(M4 — 지금은 메모리, 재시작하면 다시 연결), refresh 재사용 감지 시 토큰 가족 폐기, 공개 배포(M4)
