# 배포 — 에디터 화면과 API 중계를 Cloudflare Workers에 (ADR-047)

에디터 주소 하나(`editor.simsimeestudio.com`)가 화면(React SPA 정적 파일)을 내고, API 경로는 Worker(`apps/editor/relay`)가 Supabase 함수로 넘긴다. 설정은 레포 루트 `wrangler.jsonc`가 원천이다. API · 데이터 쪽은 [deploy-supabase.md](deploy-supabase.md).

## 1. Workers Builds 연결 (처음 한 번, 대시보드)

**Workers & Pages → blog-editor → Settings → Build**

| 항목           | 값                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Root directory | 비움(레포 루트 — `wrangler.jsonc`가 있는 곳). Worker 이름은 `wrangler.jsonc`의 `name`과 같아야 한다 |
| Build command  | `pnpm --filter @blog-editor/web build`                                                              |
| Deploy command | 기본(`npx wrangler deploy`)                                                                         |
| Branch control | 프로덕션 `main` · **Enable Preview Builds 끔**(PR마다 빌드하지 않는다)                              |

main에 머지하면 배포된다(무료 빌드 월 3,000분). 의존성 설치는 Workers Builds가 lockfile을 보고 한다.

## 2. 시크릿 · 값

- **`RELAY_SECRET`** — Settings → Variables and Secrets → Add → **Secret**. Supabase 함수 시크릿과 같은 값. 다르면 모든 API가 403이다.
- `API_ORIGIN`(함수 주소)은 `wrangler.jsonc`의 `vars`에 있다 — 공개 값이라 레포에 둔다. 대시보드에서 바꾸면 다음 배포가 덮어쓴다.
- 로그인 요청량 제한(`ratelimits`, IP당 분당 10회)도 `wrangler.jsonc`에 있다.

**순서**(어긋나면 그 사이 API가 403): ① 값 하나를 만든다(`openssl rand -base64 32`) ② Worker 시크릿 ③ Supabase 함수 시크릿 `RELAY_SECRET` ④ 함수 다시 배포.

## 3. 주소

Worker 커스텀 도메인은 도메인의 DNS가 Cloudflare에 있어야 한다. 가비아 DNS 그대로인 동안은 `https://blog-editor.<계정>.workers.dev`를 쓰고, 함수 시크릿 `PUBLIC_BASE_URL`도 그 주소로 둔다. DNS를 Cloudflare로 옮긴 뒤: Worker → Settings → Domains & Routes → Custom domain `editor.simsimeestudio.com` → `PUBLIC_BASE_URL` 바꾸기 → 함수 다시 배포 → claude.ai 커넥터 다시 연결(발급자가 바뀐다).

## 4. 배포 뒤 확인

```bash
BASE=https://blog-editor.<계정>.workers.dev   # 또는 https://editor.simsimeestudio.com
curl -s "$BASE/public/posts" | head -c 200                    # {"posts":[…]} — 중계가 함수에 닿는다
curl -s -o /dev/null -w '%{http_code}\n' https://<ref>.supabase.co/functions/v1/editor/public/posts   # 403 — 직접 호출 차단
```

브라우저: 로그인 → 글 저장 → 사진 올리기 → 미리보기 → 발행(사이트 build hook이 있으면 30초 뒤 빌드가 시작된다. 실패하면 편집 화면에 "사이트 반영 실패 · 다시 시도").
