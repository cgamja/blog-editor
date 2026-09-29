# ADR-046. Supabase 함수용 API는 rolldown으로 한 파일로 묶는다

- 날짜: 2026-09-28
- 상태: 승인됨(사용자 2026-09-28, #203)
- 관계: ADR-044(API를 Supabase Edge Functions — Deno)의 실행 방법. adr-014(로컬 Node 진입점은 번들 없이 `.ts` 그대로)는 그대로다.

## 문제 (맥락)

Supabase Edge Functions는 Deno다. 우리 api는 확장자 없는 상대 import(`./app`) · pnpm 워크스페이스 패키지(`@blog-editor/*`) · 실행 중 파일 읽기(post.css · 형식 가이드)를 쓴다 — Deno가 그대로 풀지 못한다(스파이크 2026-09-28: `import.meta.resolve("@blog-editor/content-render/post.css")` "not a dependency"). 한 파일 ESM으로 묶으면 Deno 2.9에서 로그인 · 공개 API · MCP가 그대로 돌았다(1.6MB, 2만 자 초안 저장 CPU 60~90ms).

## 결정

api 개발 의존성에 `rolldown`을 **1.2.9로 고정**해 더한다 — web의 vite 8.3.0이 쓰는 것과 같은 버전이라 lockfile에 새 패키지가 늘지 않는다. 번들 스크립트가 `edge.ts`를 ESM 한 파일로 묶어 `supabase/functions/editor/`에 쓰고(생성물, gitignore), CSS · 형식 가이드는 text 모듈로 번들 안에 넣는다. playwright-core는 배포 진입점이 import하지 않아 번들에 들지 않는다.

### 라이브러리 게이트

| 항목               | rolldown 1.2.9                                                     | esbuild                   | Deno가 직접 풀기(deno.json)                                                             |
| ------------------ | ------------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------- |
| 유지보수           | 2026-09-16 릴리스, vite 공식 번들러                                | 활발                      | —                                                                                       |
| 전이 의존성        | 2(이미 lockfile에 있음 — vite 8)                                   | 1 + 플랫폼 바이너리(새로) | 0                                                                                       |
| 라이선스           | MIT                                                                | MIT                       | —                                                                                       |
| 보안 · 타입 · 모듈 | `pnpm audit` 0건(2026-09-28, supabase-js와 함께) · 타입 내장 · ESM | 타입 내장 · ESM           | —                                                                                       |
| 사용 규모          | vite 8 기본 번들러(주 수천만 — vite 경유)                          | 주 수천만                 | —                                                                                       |
| 비용               | 설정 파일 하나                                                     | 같음                      | 가져오기 지도 · 확장자 없는 import 허용(불안정 옵션) · hono · zod 버전을 두 곳에서 관리 |

## 버린 대안

- **esbuild**: 기능은 같지만 lockfile에 새 바이너리가 는다.
- **Deno가 직접 풀기**: 새 의존성은 없지만 불안정 옵션에 기대고, 의존성 버전을 package.json과 deno.json 두 곳에서 맞춰야 한다.
- **vite를 api에 더하기**: rolldown 위에 개발 서버 · 플러그인 층을 얹을 뿐이다.

## 감수한 트레이드오프

- 배포 번들과 로컬(`.ts` 그대로)이 다르게 돈다 — Deno 스모크 테스트(번들을 불러 로그인 · 공개 · MCP)로 그 차이를 잡는다.
- vite가 rolldown을 올리면 두 버전이 갈릴 수 있다 — vite를 올릴 때 같이 맞춘다.

## 재검토 조건

- Supabase Edge Functions가 Node 호환 해석(확장자 없는 import · pnpm 워크스페이스)을 정식 지원할 때
- 2단계 AWS Lambda 이전 때(같은 번들을 쓸지 다시 본다)
