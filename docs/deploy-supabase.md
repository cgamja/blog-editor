# 배포 — 에디터 API를 Supabase에 (ADR-044)

에디터 API(Hono)는 Supabase Edge Function `editor` 하나로, 글 · 설정 · 사진 · 로그인 기록은 Supabase Postgres · Storage에 둔다. 에디터 화면과 `/api` 중계는 #204. 로컬 개발은 지금처럼 `pnpm start`(Memory · File)이고 이 문서가 필요 없다.

프로젝트는 둘이다 — **운영**(`SUPABASE_URL`)과 **시험용**(`SUPABASE_TEST_URL`, 계약 테스트 · 복구 검증 전용, 비워도 되는 곳). 명령의 `<ref>`는 대시보드 주소 `…/project/<ref>`의 그 값이다.

## 1. 표 만들기 · 바꾸기 (마이그레이션)

스키마의 원천은 `supabase/migrations/`다. 대시보드에서 표를 손으로 고치지 않는다.

```bash
# 먼저 시험용에 — 계약 테스트가 초록인지 본 뒤 운영에
npx supabase@2.118.0 db push --db-url "$SUPABASE_TEST_DB_URL"
npx supabase@2.118.0 db push --db-url "<운영 Session pooler URI>"
```

DB 주소는 대시보드 **Connect → Connection String → Session pooler**(포트 5432). 새 프로젝트는 표에 역할 권한을 기본으로 주지 않는다 — 새 표를 만들면 마이그레이션에 `grant … to service_role`을 같이 쓴다.

## 2. 함수 시크릿

대시보드 **Edge Functions → Secrets**(또는 `npx supabase secrets set --project-ref <ref> 이름=값`). `SUPABASE_`로 시작하는 이름은 Supabase가 쓰므로 우리 값은 다른 이름이다(`SUPABASE_URL`은 자동으로 들어온다).

| 이름                                                      | 값                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD_HASH`                                     | `printf '%s' "$(pbpaste)" \| node apps/editor/api/src/hash-password.ts` — **해시만**. 평문 `ADMIN_PASSWORD`를 주면 함수가 뜨지 않는다                                                                                                                                                                                                         |
| `ADMIN_USERNAME`                                          | 추측하기 어려운 아이디 권장(잠금 서비스 거부 비용을 줄인다, ADR-045). 없으면 admin                                                                                                                                                                                                                                                            |
| `SESSION_SECRET`                                          | `openssl rand -base64 48` — 32바이트 이상. 바꾸면 모든 로그인이 끊긴다                                                                                                                                                                                                                                                                        |
| `PUBLIC_BASE_URL`                                         | `https://editor.simsimeestudio.com` — OAuth 발급자 · MCP 주소. **경로 없는 에디터 주소**(`/api` 중계, #204)이고 Supabase 함수 주소(`…/functions/v1/editor`)는 거부된다 — OAuth 발급자는 경로가 없어야 하고, 로그인 쿠키가 에디터 주소에서 1자 쿠키여야 한다. 중계 전에는 `/mcp`를 연결용 토큰으로 함수 주소에 바로 붙여 쓴다(OAuth는 중계 뒤) |
| `EDITOR_SECRET_KEY`                                       | 운영 프로젝트 **Secret key**(`sb_secret_…`)                                                                                                                                                                                                                                                                                                   |
| `MCP_CONNECTION_TOKEN_HASH` · `MCP_CONNECTION_TOKEN_NAME` | 선택. `printf '%s' "<토큰>" \| shasum -a 256` 의 앞 64자 · 출처 이름. 없으면 `/mcp`는 OAuth 토큰만 받는다                                                                                                                                                                                                                                     |
| `EDITOR_BASE_URL` · `IMAGE_BASE_URL`                      | 선택. 기본은 `PUBLIC_BASE_URL` · `https://simsimeestudio.com`                                                                                                                                                                                                                                                                                 |

## 3. 함수 배포

```bash
pnpm --filter @blog-editor/api build:edge          # supabase/functions/editor/에 번들을 쓴다(생성물, 커밋 안 함)
npx supabase@2.118.0 functions deploy editor --use-api --project-ref <ref>
```

JWT 검증은 `supabase/config.toml`의 `[functions.editor] verify_jwt = false`가 끈다 — 이 API는 자체 세션 · 토큰을 쓴다. 확인: `curl https://<ref>.supabase.co/functions/v1/editor/public/posts` → `{"posts":[…]}`.

배포에서 `preview_post`(미리보기 이미지)는 "지원 안 함" 도구 오류다 — 브라우저가 필요해 로컬 서버에서만 된다. 무료 Supabase는 GET 요청의 HTML 응답을 `text/plain`으로 바꾼다 — OAuth 로그인 화면(`GET /oauth/authorize`)은 #204의 중계가 Content-Type을 되돌린다.

## 4. 로그인 잠금 풀기

5번 연속 틀리면 잠기고, 잠길 때마다 두 배(15분 → 30분 … 최대 24시간)다. 시도는 비밀번호를 보기 전에 세므로 동시에 여러 개를 보내도 잠금 한 번에 5번까지만 확인한다. 로그인에 성공해야 처음으로 돌아간다(ADR-045). 주인이 잠겼으면 대시보드 **SQL Editor**에서:

```sql
delete from public.login_lockouts;
```

## 5. 백업 · 복구

`.github/workflows/backup.yml`이 매일 03:00(KST) 운영 DB 데이터 덤프 + 사진 + 대조 목록을 묶어 **암호화한 파일**을 아티팩트로 올린다(90일). 레포가 공개라 암호화하지 않은 것은 올리지 않는다. 실패하면 Actions 빨간불 · GitHub 알림.

GitHub **Settings → Secrets and variables → Actions**에 넣을 것:

| 이름                                                                                                        | 쓰는 곳                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `SUPABASE_DB_URL` · `SUPABASE_URL` · `SUPABASE_SECRET_KEY`                                                  | 백업(운영)                                                                                 |
| `BACKUP_PASSPHRASE`                                                                                         | 백업 암호 — `openssl rand -base64 32`. **비밀번호 관리자에도 둔다**(잃으면 백업을 못 연다) |
| `SUPABASE_TEST_URL` · `SUPABASE_TEST_SECRET_KEY` · `SUPABASE_TEST_PUBLISHABLE_KEY` · `SUPABASE_TEST_DB_URL` | CI 계약 테스트 · 복구 검증(시험용)                                                         |

**복구**(새 또는 비운 프로젝트에 — 순서가 중요하다):

```bash
gh run download <백업 run id> --dir artifact
gpg --decrypt --output backup.tar.gz artifact/*/editor-backup.tar.gz.gpg   # BACKUP_PASSPHRASE
tar -xzf backup.tar.gz                                                      # backup/dump.sql · images/ · manifest.json
npx supabase@2.118.0 db push --db-url "<대상 DB 주소>"                        # ① 스키마(레포 마이그레이션)
psql "<대상 DB 주소>" -v ON_ERROR_STOP=1 --file backup/dump.sql             # ② 데이터
TARGET_SUPABASE_URL=… TARGET_SECRET_KEY=… node apps/editor/api/scripts/backup-storage.ts restore backup   # ③ 사진
TARGET_SUPABASE_URL=… TARGET_SECRET_KEY=… node apps/editor/api/scripts/backup-storage.ts verify backup    # 대조
```

그 뒤 함수 시크릿의 `EDITOR_SECRET_KEY`를 새 프로젝트 키로 바꾸고 3의 배포를 새 `<ref>`로 한다.

**복구 검증**: `.github/workflows/restore-verify.yml`이 분기마다(수동 실행도 가능) 최신 백업을 시험용 프로젝트에 복원하고 글 revision · 사진 이름이 대조 목록과 같은지 본다. 순서는 위와 같되 ① 스키마를 `db push` 대신 `db reset`(시험 프로젝트를 비우고 마이그레이션을 다시 적용)으로 만든다 — 운영 복구는 새로 만든 빈 프로젝트라 `db push`와 결과가 같다. 레포가 공개라 검증 로그에는 개수만 찍힌다(어느 글인지는 로컬에서 같은 명령으로 본다).

## 무료 한도 · 일시 정지

무료 플랜은 DB 500MB · Storage 1GB · 함수 월 50만 호출, **1주 동안 요청이 없으면 일시 정지**된다(대시보드 **Restore**로 재개. 멈춰도 사이트는 정적이라 뜬다). 한도에 닿거나 비용이 생기면 2단계 AWS(ADR-044 재검토 조건).
