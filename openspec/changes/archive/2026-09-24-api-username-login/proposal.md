# api-username-login (이슈 #31)

## Why

사용자 요청(2026-09-24): "로그인할 때 그냥 어드민 ID/PW로 하고싶은데 (ex. admin / 1234)". 지금은 email로 로그인하고, 로컬 서버를 띄우려면 20자 이상 비밀번호로 해시를 먼저 만들어 env에 넣어야 한다.

## What Changes

- 계정 식별자를 email에서 아이디(`username`)로 바꾼다. `POST /api/session` 본문은 `{ username, password }`. 계정 테이블 구조(adr-007)는 그대로다.
- 로컬 진입점(`serve.ts`)은 평문 `ADMIN_PASSWORD`를 받아 시작할 때 해시한다(또는 기존 `ADMIN_PASSWORD_HASH`). `ADMIN_USERNAME` 기본값은 `admin`, `SESSION_SECRET`이 없으면 시작할 때 무작위로 만든다. 로컬은 루프백 전용이라 짧은 비밀번호를 허용한다.

## Impact

- `apps/editor/api` — accounts · memory-account-store · session · messages · serve, 새 `local-config.ts`(env 해석 순수 함수)
- 배포(M4) 진입점은 이 로컬 경로를 쓰지 않는다. 짧은 비밀번호로 배포하려면 D8의 잠금 카운터를 M4에서 같이 넣는다.
