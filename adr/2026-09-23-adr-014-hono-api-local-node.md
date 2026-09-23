# ADR-014. API는 Hono로 쓰고, M1~M3는 로컬 Node(`@hono/node-server`)에서 돌린다

- 날짜: 2026-09-23
- 상태: 승인됨
- 원천: plan 02 Tech Stack("API 서버 — AWS Lambda + Hono") · D12 로컬 우선 · 3-6 API · adr-004(PostStore) · adr-005(AWS 서버리스) · 이슈 #19

## 문제 (맥락)

글 API · 공개 조회 · (다음) 세션 · MCP가 한 앱에 모인다. 라우트는 10개 미만이지만 같은 핸들러가 두 곳에서 돌아야 한다 — M1~M3는 로컬 Node(D12, 클라우드 · Supabase 없이), M4부터 Lambda. 진입점만 바꾸고 핸들러 · 테스트는 그대로여야 로컬에서 되던 것이 운영에서도 된다.

## 결정

- `apps/editor/api`의 dependency로 `hono`, 로컬 진입점용으로 `@hono/node-server`를 둔다. Lambda 진입점은 M4에서 `hono/aws-lambda`(hono 본체에 포함, 추가 패키지 없음)로 붙인다.
- 앱은 `createApp({ store, categories, imageBaseUrl })` 팩토리 하나다. 저장소는 주입한다(`MemoryPostStore` · `FilePostStore` · M4의 `S3PostStore`). 핸들러 테스트는 `app.request()`로 서버를 띄우지 않고 Vitest node에서 돈다.
- LIBRARY 게이트(cgamja `docs/spec/LIBRARY.md`) 검진 — 2026-09-23 기준:

| 항목        | 값                                                                             | 판정 |
| ----------- | ------------------------------------------------------------------------------ | ---- |
| 유지보수    | hono 4.13.8(2026-09-15) · @hono/node-server 2.1.1(2026-08-14)                  | 통과 |
| 사용 규모   | 웹 표준 서버 프레임워크의 사실상 표준, 공식 어댑터                             | 통과 |
| 번들 크기   | 서버 전용 — 에디터 화면 · 공개 사이트에 안 나간다                              | 통과 |
| 전이 의존성 | 둘 다 dependency 0(node-server는 hono ^4 peer)                                 | 통과 |
| 보안        | `pnpm audit --prod` high/critical 없음(설치 시 확인). 입력은 전부 zod를 지난다 | 통과 |
| 타입        | TS 내장                                                                        | 통과 |
| 모듈 형식   | ESM, Node 22 · Lambda 둘 다 공식 지원                                          | 통과 |
| 라이선스    | 둘 다 MIT                                                                      | 통과 |

## 버린 대안

- **Node `http` 직접 + 라우터 손으로**: 의존성 0이지만 Lambda 이벤트 변환 · 쿠키 · 헤더 파싱을 다시 짠다. 라우트가 늘어날수록(세션 · MCP · OAuth) 손 라우터가 커진다.
- **Express · Fastify**: Node 전용 요청 객체라 Lambda에서 어댑터가 무겁고, 웹 표준 `Request`/`Response`가 아니어서 다른 플랫폼으로 옮기는 대안책(plan 02)이 약해진다.
- **Supabase Edge Functions로 먼저 배포**: D12에서 이미 버렸다 — 이전 작업 · Deno/Node 런타임 차이 · 프록시 · 무료 플랜 일시정지 비용이 로컬 우선에는 없다.

## 감수한 트레이드오프

- 파일 저장소의 충돌 검사는 같은 프로세스 안에서만 원자적이다(slug별 직렬화). 로컬 개발은 프로세스 하나라 충분하고, 운영 원자성은 S3 조건부 쓰기(adr-004)가 맡는다.
- AWS에서만 터지는 문제(페이로드 형식 · 쿠키 도메인 · Lambda 어댑터)는 M4까지 늦게 본다 — M0 스파이크 #3이 최소 스택으로 먼저 확인한다(D12 성립 조건).

## 재검토 조건

- MCP SDK(스파이크 #4)가 Hono와 같은 요청 모델에서 못 돌 때 — `/mcp`만 다른 진입점으로 떼는 것을 검토한다.
- Lambda 콜드 스타트가 공개 조회 빌드 시간을 눈에 띄게 늘릴 때.
