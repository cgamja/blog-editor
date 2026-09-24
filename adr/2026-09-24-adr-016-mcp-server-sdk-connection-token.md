# ADR-016. MCP는 공식 SDK v2(`@modelcontextprotocol/server`)의 무상태 fetch 핸들러로 Hono에 붙이고, 첫 인증은 연결용 토큰(Bearer)이다

- 날짜: 2026-09-24
- 상태: 승인됨 · OAuth 부분 → adr-018
- 원천: adr-007(초안만 · 발행 도구 없음 · 연결용 토큰 · OAuth) · adr-014(Hono · 재검토 조건 "MCP SDK가 같은 요청 모델에서 못 돌 때") · plan 3-12 · 이슈 #32 · 스파이크 #4

## 문제 (맥락)

AI(채팅 앱)가 글 초안을 쓰게 하려면 서버가 MCP 엔드포인트(`/mcp`)를 노출해야 한다(adr-007). MCP는 JSON-RPC 위에 프로토콜 버전 협상 · 도구 목록 · 입력 JSON Schema · Streamable HTTP(SSE 응답) · 두 세대의 프로토콜(2025-era 세션 핸드셰이크와 2026-07-28 요청별 봉투)이 얹힌 규격이다. 같은 핸들러가 로컬 Node(M1~M3)와 Lambda(M4)에서 돌아야 하고(adr-014), 인증은 claude.ai 커넥터가 실제로 받아 주는 방식이어야 한다.

## 결정

- `apps/editor/api`에 `@modelcontextprotocol/server` `~2.0.0`을 더한다(공식 TypeScript SDK v2의 서버 패키지). `createMcpHandler(factory)`가 돌려주는 웹 표준 `fetch(Request) → Response`를 Hono 라우트 `/mcp`에 그대로 넘긴다 — 프레임워크 어댑터(`@modelcontextprotocol/hono`)는 쓰지 않는다. 요청마다 새 `McpServer`를 만드는 **무상태** 서빙이라 Lambda 요청-응답 모델과 맞고, 세션 저장소가 필요 없다.
- 도구 입력 스키마는 zod다. zod는 이미 content-schema가 쓰는 같은 버전(`^4.6.5`)을 api에도 선언한다(새 라이브러리 아님).
- 2.1.0이 아니라 2.0.x에 고정한다: 2.1.0은 하루 전(2026-09-23) 공개돼 pnpm 최소 공개 기간 게이트에 걸렸고, pnpm이 `pnpm-workspace.yaml`에 예외를 자동으로 적었다 — 그 예외는 되돌렸다. 게이트를 지난 뒤 올린다.
- **첫 인증은 연결용 토큰**: `Authorization: Bearer <token>`. 서버는 토큰의 SHA-256만 저장하고(무작위 고엔트로피 토큰이라 느린 해시가 필요 없다), 맞으면 `authInfo`로 도구에 넘긴다. 토큰이 없거나 틀리면 401. 범위는 초안 읽기 · 쓰기뿐 — 발행 도구가 없고, 쓰기 도구는 `draft: true`만 쓴다.
- **OAuth는 다음 change**로 뗀다. claude.ai는 "No sign-in + Request headers"로 고정 Bearer 토큰을 보낼 수 있지만 그 기능은 베타 · 일부 조직만이다(claude.com/docs/connectors/custom/remote-mcp "Authenticating with request headers"). 그 기능이 없는 계정에서 claude.ai에 붙이려면 OAuth(DCR 또는 CIMD, S256 PKCE, protected resource metadata)가 필요하다(claude.com/docs/connectors/building/authentication).
- 사람이 가장 먼저 붙여 볼 수 있는 길은 **Claude Code**다 — `claude mcp add --transport http … --header "Authorization: Bearer …"`로 로컬 `127.0.0.1`에 바로 붙는다. claude.ai는 Anthropic 클라우드(160.79.104.0/21)에서 접속하므로 서버가 공개 인터넷에서 HTTPS로 닿아야 한다 — 로컬이면 터널이 필요하다(M4 배포 뒤에는 불필요).

LIBRARY 게이트(cgamja `docs/LIBRARY.md`) — 2026-09-24 기준:

| 항목            | `@modelcontextprotocol/server` 2.0.0 (채택)                           | `@modelcontextprotocol/sdk` 1.30.1 (v1)           | `@hono/mcp` 0.3.2                                   |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| 유지보수        | 2.0.0 2026-07-27 · 2.1.0 2026-09-23                                   | 1.30.1 2026-09-23                                 | 0.3.2 2026-08-18                                    |
| 사용 규모(주간) | 약 432만                                                              | 약 4,030만                                        | 약 27만                                             |
| 전이 의존성     | `@modelcontextprotocol/core` · `zod` 둘                               | express · cors · ajv · jose · eventsource 등 17개 | v1 SDK를 peer로 끌어온다 + `hono-rate-limiter` peer |
| 번들            | 서버 전용(설치 약 6.4MB, core 1.3MB) — 화면 · 공개 사이트에 안 나간다 | 서버 전용, Node 전용 의존성 다수                  | 어댑터 자체는 작지만 v1 전체가 딸려 온다            |
| 보안            | `pnpm audit --prod` 취약점 없음                                       | —                                                 | —                                                   |
| 타입            | TS 내장                                                               | TS 내장                                           | TS 내장                                             |
| 모듈 형식       | ESM · 웹 표준 fetch 핸들러 → Node · Lambda 둘 다                      | Node `http` 전송 중심                             | Hono 전용                                           |
| 라이선스        | MIT                                                                   | MIT                                               | MIT                                                 |

게이트 1~3: 문제(프로토콜 협상 · 두 세대 · SSE · JSON Schema)는 엣지 케이스가 본질인 규격 구현이라 직접 구현이 더 비싸다. 같은 문제를 푸는 라이브러리는 프로젝트에 없다.

## 버린 대안

- **v1 `@modelcontextprotocol/sdk`**: 다운로드는 가장 많지만 express · cors 등 Node 서버 스택이 통째로 딸려 오고, v2가 안정 릴리스 라인이다(README "v2 is the stable release line, implementing the 2026-07-28 MCP spec").
- **`@hono/mcp` 어댑터**: v1 SDK를 peer로 요구한다. v2의 fetch 핸들러를 Hono 라우트에 넘기는 데 어댑터가 필요 없다.
- **JSON-RPC 직접 구현**: 도구 셋이면 수십 줄로 보이지만, 프로토콜 버전 협상 · 두 세대 · SSE · 입력 검증 오류 형식을 우리가 따라가야 한다. 규격이 바뀔 때마다 우리 코드가 틀린다.
- **처음부터 OAuth**: claude.ai 공식 경로지만 인가 서버(DCR/CIMD · PKCE · 토큰 저장 · 갱신 회전)가 한 change로는 크다. 도구와 초안 규칙을 먼저 고정하고 Claude Code로 끝에서 끝까지 확인한 뒤 붙인다.

## 감수한 트레이드오프

- claude.ai에서 Request headers 베타가 없는 계정은 OAuth change 전까지 claude.ai로 붙일 수 없다 — Claude Code로는 된다.
- 연결용 토큰은 워크스페이스에 하나씩 공유되는 비밀이라, 새면 초안을 쓸 수 있다(발행은 못 한다 — adr-007의 성립 조건). 폐기는 env 교체(M6 설정 화면에서 발급 · 폐기).
- v2는 2026-07 안정화라 v1보다 생태계 예제가 적다. SDK 부 버전 업그레이드를 따로 챙긴다.
- 크기 제한은 여기서 한다(요청 본문 1 MiB → 413, markdown 20만 자). 초안 개수 한도 · 요청 횟수 제한(plan 3-12 방어)은 이 change에 없다 — M4 스로틀과 함께.

## 재검토 조건

- OAuth change에서 SDK의 인가 도우미가 무상태 모델과 안 맞을 때.
- Lambda에서 SSE 응답이 버퍼링돼 도구 응답이 늦을 때 — `responseMode: 'json'` 검토.
- claude.ai Request headers가 정식이 되면 OAuth 우선순위를 다시 본다.
