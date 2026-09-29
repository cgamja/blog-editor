# ADR-047. 에디터 화면은 Cloudflare Workers에 두고, 같은 주소에서 API를 Supabase 함수로 중계한다

- 날짜: 2026-09-29
- 상태: 제안됨(#204)
- 관계: ADR-044의 "에디터 화면 = Netlify"를 **대체**한다. API · 데이터(Supabase)와 사이트 재빌드(adr-001)는 그대로다.

## 문제 (맥락)

ADR-044는 에디터 화면을 Netlify에 두고 `/api`를 Netlify 리라이트로 Supabase 함수에 넘기려 했다. 그 뒤 사용자가 화면을 Cloudflare에 연결했고(2026-09-28, 대시보드는 Workers 프로젝트 "blog-editor"), #203 실측으로 무료 Supabase가 `GET`의 HTML을 `text/plain`으로 바꾼다는 것이 드러났다 — 리라이트는 헤더를 고칠 수 없다. #206 리뷰(CWE-400)는 로그인 경로 폭주와 함수 주소 직접 호출을 **함수 앞단**에서 막으라고 했다. 둘 다 코드가 도는 중계가 필요하다.

## 결정

- **Cloudflare Workers + 정적 자산 한 개**(레포 루트 `wrangler.jsonc`): `apps/editor/web/dist`를 SPA로 내주고, `run_worker_first`에 적은 API 경로만 Worker 코드(`apps/editor/relay`)가 받아 Supabase 함수로 넘긴다. 화면과 API가 한 주소라 로그인 쿠키는 1자 쿠키다.
- 중계만 하는 일: `GET /authorize`의 Content-Type 되돌리기 · 로그인 두 경로 IP당 분당 10회(Workers Rate Limiting 바인딩) · 함수로 갈 때 `X-Relay-Secret` 붙이기. 함수는 그 헤더가 맞지 않으면 403 — 함수 주소는 사실상 닫힌다(`/mcp` 포함).
- **배포는 main 머지마다**(Workers Builds). ADR-044의 "내보낼 때만"은 Netlify 크레딧 때문이었고, Workers Builds 무료는 월 3,000분이다.
- **wrangler는 의존성에 넣지 않는다** — 배포 명령(`npx wrangler deploy`)만 쓰고, 중계 코드는 표준 `Request`/`Response`만 써서 Vitest node로 시험한다.
- 사이트 재빌드(adr-001)는 호스팅과 무관하게 **훅 URL 하나(`SITE_BUILD_HOOK_URL`)에 POST**, 30초 묶기, 상태는 Postgres `site_rebuilds`.

## 버린 대안

- **Netlify 리라이트(ADR-044)**: 헤더를 고치지 못하고 요청량 제한도 없다. 크레딧 때문에 배포를 손으로 해야 한다.
- **Cloudflare Pages + Pages Functions**: 같은 일을 하지만 대시보드 프로젝트가 이미 Workers이고, Cloudflare가 새 프로젝트를 Workers로 안내한다.
- **함수 안에서 요청량 제한**: 호출이 이미 일어난 뒤라 무료 호출 한도(월 50만)를 지키지 못한다.
- **발행 때 바로 훅 호출(묶기 없음)**: 발행 · 수정을 연달아 하면 빌드가 줄을 선다(무료 동시 1).

## 감수한 트레이드오프

- 서비스가 셋(Supabase · Cloudflare · 사이트 호스팅)이고 `RELAY_SECRET`을 두 곳에 같은 값으로 넣어야 한다 — 어긋나면 모든 API가 403(배포 문서에 순서를 적는다).
- API 요청이 Worker를 한 번 더 거친다 — 무료 하루 10만 요청 안에 든다(정적 파일은 세지 않는다).
- Rate Limiting은 로케이션별 · 느슨한 집계다. 정확한 잠금은 함수의 누적 잠금(ADR-045)이 맡고, 중계는 폭주만 깎는다.
- 커스텀 도메인은 Cloudflare DNS가 전제다 — DNS 이전(사용자) 전까지는 `*.workers.dev` 주소를 쓴다.
- 재빌드 묶기는 함수의 응답 뒤 작업(`EdgeRuntime.waitUntil`)에 기댄다 — 인스턴스가 먼저 죽으면 `pending`이 남는다. 1분이 넘은 `pending`은 읽을 때 `failed`로 보여 화면의 "다시 시도"로 푼다.
- 요청량 한도(분당 10)와 중계 경로 목록이 `wrangler.jsonc`와 `relay.ts` 두 곳에 있다 — 설정 파일은 코드를 import하지 못한다. 바꿀 때 둘 다 바꾼다.
- `site_rebuilds` 갱신은 조건부 쓰기가 아니다 — 인스턴스 둘이 겹치면 드물게 새 `pending`을 덮을 수 있다. 1인 사용이고 창이 ms 단위라 감수하고, "다시 시도"로 푼다.

## 재검토 조건

- Workers 무료 하루 10만 요청이나 Rate Limiting 무료 이용이 막히면
- 2단계 AWS 이전(ADR-044) 때 — 중계 자리는 CloudFront 함수 · Lambda@Edge가 받는다
