# deploy-connect (이슈 #204)

## Why

#203으로 에디터 API가 Supabase 함수(`<ref>.supabase.co/functions/v1/editor`)에 올라갔다. 화면(React SPA)은 아직 올라가 있지 않고, 화면과 API가 다른 주소면 로그인 쿠키가 3자 쿠키가 된다. 무료 Supabase는 `GET`의 HTML을 `text/plain`으로 바꿔 OAuth 로그인 화면(`GET /authorize`)이 깨진다. 발행해도 블로그 사이트는 재빌드해야 새 글이 보이는데(adr-001), 신호를 보내는 코드가 없다. #206 리뷰(CWE-400)는 로그인 경로 폭주와 함수 주소 직접 호출을 함수 앞단에서 막으라고 넘겼다.

## What Changes

- **에디터 주소 중계**(`apps/editor/relay`, Cloudflare Worker + 정적 자산): 화면 파일을 내주고, API 경로(`/api/*` · `/public/*` · `/images/*` · `/mcp` · `/authorize` · `/register` · `/token` · `/.well-known/*`)는 Supabase 함수로 넘긴다. `GET /authorize`만 Content-Type을 되돌린다. 로그인 두 경로는 IP당 분당 10회로 자른다. 함수로 갈 때 중계만 아는 헤더(`RELAY_SECRET`)를 붙이고, 함수는 그 헤더가 없으면 403이다.
- **발행하면 사이트 재빌드**: 발행 · 발행 취소 · 발행 글 수정이 저장되면 30초 묶어 `SITE_BUILD_HOOK_URL`에 POST 한 번. 상태(`대기` · `보냄` · `실패`)는 저장소에 남고 편집 화면이 실패를 알리며 다시 시도할 수 있다.

## 결정 (가정 — 틀리면 고친다)

- **Pages가 아니라 Workers**: Cloudflare 대시보드의 프로젝트가 이미 Workers("Workers Builds: blog-editor")다. 정적 자산 + `run_worker_first` 배열로 API 경로만 Worker가 받는다. 레포 루트 `wrangler.jsonc`.
- **배포는 main 머지마다**: 이슈의 "내보낼 때만"은 Netlify 크레딧(배포 1회 15) 때문이었다. Workers Builds 무료는 월 3,000분이라 이유가 사라졌다.
- **커스텀 도메인은 DNS 이전 뒤**: Worker 커스텀 도메인은 Cloudflare DNS가 전제다(가비아 그대로는 불가). 그전엔 `*.workers.dev` 주소를 `PUBLIC_BASE_URL`로 쓴다.
- **`/mcp` 예외 없음**: MCP도 중계 주소로 붙인다 — 함수 주소 직접 호출은 모두 403.
- **재빌드 훅은 사이트 호스팅과 무관**: Netlify build hook · Cloudflare Pages deploy hook 모두 URL에 POST라 이름 하나(`SITE_BUILD_HOOK_URL`). 없으면 재빌드를 끈다(로컬 기본).
- **묶기는 함수 안에서**: 응답 뒤 `EdgeRuntime.waitUntil`로 30초 기다려(무료 벽시계 150초 안) 마지막 요청만 보낸다. 다시 시도는 묶지 않고 바로 보낸다.
- **wrangler는 의존성에 넣지 않는다**: Workers Builds의 배포 명령(`npx wrangler deploy`)이 쓴다. 중계 코드는 Worker 타입 없이 표준 `Request`/`Response`로만 쓰고 Vitest node에서 시험한다.

## Impact

- 새 패키지 `@blog-editor/relay`(아무것도 import하지 않는 잎) · 레포 루트 `wrangler.jsonc` · ADR-047(ADR-044의 "에디터 화면 Netlify"를 뒤집는다).
- 함수 시크릿 `RELAY_SECRET`이 필수가 된다 — 배포 순서: Worker 시크릿 → 함수 시크릿 → 함수 배포.
- 새 표 `site_rebuilds`(마이그레이션 1개).
