# Spec Delta — edge-deploy

## Purpose

에디터 API(Hono 앱)를 Supabase Edge Function(Deno) 하나로 배포하는 진입점. 앱 본체 · 라우트는 로컬 Node 진입점과 같고, 입구 · 저장소 · 설정 읽기만 다르다(ADR-044 · adr-014).

## ADDED Requirements

### Requirement: 배포 함수는 로컬과 같은 라우트를 Supabase 저장소로 연다

배포 진입점은 SHALL 한 파일로 번들된 같은 Hono 앱을 Supabase 저장소(글 · 설정 · AI 되돌리기 · 사진 · OAuth · 로그인 잠금)로 만들고, 함수 이름 경로(`/<함수>/…`)를 떼어 `/api/*` · `/public/*` · `/images/*` · `/mcp` · OAuth 경로를 로컬과 같은 주소로 받는다. 본문 CSS · 형식 가이드는 번들 안에 들어 있어 실행 중에 파일을 읽지 않는다.

#### Scenario: 함수 경로 뒤의 주소가 앱 라우트로 간다

- **WHEN** 번들된 핸들러에 `/<함수>/public/posts`와 `/<함수>/public/post.css`를 GET 한다
- **THEN** 로컬 앱과 같은 공개 목록(발행 글만)과 `text/css` 본문 CSS가 나온다

#### Scenario: 번들은 Deno에서 뜬다

- **WHEN** 배포 번들을 Deno로 불러 로그인 · 공개 조회 · `/mcp` `tools/list`를 부른다
- **THEN** 셋 다 성공하고 번들에 playwright-core가 들어 있지 않다

### Requirement: 배포 설정은 해시와 비밀만 받고 빠지면 뜨지 않는다 (보호 대상)

배포 진입점은 SHALL 비밀번호를 해시(`ADMIN_PASSWORD_HASH`)로만, 연결용 토큰을 해시(`MCP_CONNECTION_TOKEN_HASH`)로만 받고 평문 `ADMIN_PASSWORD` · `MCP_CONNECTION_TOKEN`은 거부한다. `SESSION_SECRET`(32바이트 이상) · `PUBLIC_BASE_URL`(https) · Supabase 주소와 비밀 키가 없으면 요청을 처리하지 않고 무엇이 빠졌는지 알리며 멈춘다. 세션 쿠키는 `__Host-session`(Secure)이다.

#### Scenario: 평문 비밀번호를 주면 거부한다

- **WHEN** 배포 설정에 `ADMIN_PASSWORD`를 준다
- **THEN** 설정 읽기가 "해시만 받는다 — hash-password.ts" 오류로 실패한다

#### Scenario: 세션 비밀이 없으면 뜨지 않는다

- **WHEN** `SESSION_SECRET` 없이 배포 설정을 읽는다
- **THEN** 빠진 이름을 알리는 오류다(로컬처럼 새로 만들지 않는다 — 요청마다 켜지는 함수에선 세션이 끊긴다)

### Requirement: 배포에서 preview_post는 지원 안 함 도구 오류다

배포 MCP 서버는 SHALL `preview_post`를 목록에 두되 부르면 "이 서버에서는 미리보기 이미지를 찍을 수 없다 — 로컬 서버에서 부르거나 get_post로 확인" 도구 오류를 준다. 글은 바꾸지 않는다. 로컬 진입점의 `preview_post`는 그대로다(mcp-drafts).

#### Scenario: 배포에서 미리보기를 부르면 도구 오류다

- **WHEN** 찍기 수단 없이 만든 앱의 `/mcp`로 있는 글의 `preview_post`를 부른다
- **THEN** `isError`인 도구 결과이고 안내 문장이 있다

실패 의미론: 해당 없음 — 상태는 저장소가 갖고, 진입점은 요청마다 같은 앱을 만든다.
