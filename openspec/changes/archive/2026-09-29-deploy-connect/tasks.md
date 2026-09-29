# Tasks — deploy-connect (#204)

- [x] 0.1 ADR-047(에디터 화면 Cloudflare Workers + 중계 · main 머지마다 배포 · 함수 직접 호출 차단 · 재빌드 훅) · #204 본문 갱신 · 새 패키지 매니페스트(`apps/editor/relay/package.json` · `tsconfig.json`) · eslint 경계(잎) → verify: 매니페스트 diff 사람 승인 · `pnpm install`
- [x] 1.1 테스트(red): 중계 `apps/editor/relay/src/relay.test.ts`(editor-relay 시나리오) · 함수 쪽 `X-Relay-Secret`(api edge) · 재빌드(api: 트리거 조건 · 묶기 · 실패 · 다시 시도 · 401 · 저장소 계약 memory/supabase) · 화면 배너 e2e → verify: 빨강 원문
- [x] 2.1 중계 — `apps/editor/relay/src/relay.ts`(순수 함수) · `worker.ts`(입구) · 루트 `wrangler.jsonc`(정적 자산 SPA · `run_worker_first` · `ratelimits` · `vars.API_ORIGIN`) → verify: 중계 테스트 초록
- [x] 3.1 함수 — `edge-config.ts` `RELAY_SECRET` 필수 · `edge.ts`가 앱 앞에서 비교(상수 시간) → verify: edge 테스트 초록
- [x] 4.1 재빌드 — `site-rebuild.ts`(묶기 · 훅 호출 · 상태) · 저장소(memory · supabase) · 마이그레이션 `site_rebuilds` · `PUT` 연결 · `GET/POST /api/site-rebuild` · 설정(`SITE_BUILD_HOOK_URL` 로컬 · 배포, 배포는 `EdgeRuntime.waitUntil`) → verify: api 테스트 초록 · 시험 프로젝트 `db push`
- [x] 5.1 화면 — 발행 관련 저장 뒤 상태 다시 읽기 · 실패 배너 + 다시 시도 → verify: e2e 초록 · 스크린샷
- [x] 6.1 문서 — `docs/deploy-supabase.md`에 `RELAY_SECRET` · `SITE_BUILD_HOOK_URL`, 새 `docs/deploy-cloudflare.md`(빌드 명령 · 시크릿 · 도메인 · 배포 순서) → verify: `pnpm docs:check`
- [x] 7.1 Converge — 두 스펙 시나리오 ↔ 테스트 대조 · `pnpm verify` → verify: 초록 출력
