# api-session Specification

## Purpose

에디터 API의 로그인(plan 3-5 · D8 · D13) — 계정 테이블의 scrypt 해시로 비밀번호를 확인하고 HMAC 서명 세션 쿠키를 준다. `/api/*`는 세션 없이는 401이고, `/public/*`는 공개 그대로다.

## Requirements

### Requirement: 계정 테이블의 비밀번호로 로그인하면 서명 세션 쿠키를 받는다

`POST /api/session`은 SHALL 본문 `{ username, password }`를 계정 테이블(1단계 시드 1행)의 scrypt 해시와 비교하고, 맞으면 204와 HMAC 서명 세션 쿠키를 준다. 아이디는 앞뒤 공백을 빼고 대소문자를 무시해 찾는다. 쿠키는 `HttpOnly` · `Secure` · `SameSite=Strict` · `Path=/` · `Max-Age`를 갖고, 서명된 값 안에도 만료 시각이 있어 서버가 따로 검사한다. 본문이 JSON이 아니거나 모양이 다르면 400이다.

#### Scenario: 맞는 비밀번호로 로그인하면 속성을 갖춘 세션 쿠키가 온다

- **WHEN** 시드 계정의 아이디와 비밀번호로 `POST /api/session`을 부른다
- **THEN** 204이고 `Set-Cookie`에 `HttpOnly` · `Secure` · `SameSite=Strict` · `Path=/` · `Max-Age`가 있다

#### Scenario: 아이디는 앞뒤 공백과 대소문자를 무시한다

- **WHEN** 시드 아이디 `admin`을 `" Admin "`으로 적어 맞는 비밀번호로 로그인한다
- **THEN** 204다

#### Scenario: 비밀번호 해시는 왕복하고 다른 비밀번호는 맞지 않는다

- **WHEN** 비밀번호를 해시한 뒤 같은 비밀번호와 한 글자 다른 비밀번호로 각각 검증한다
- **THEN** 차례로 맞음 · 틀림이고, 해시 문자열에 원래 비밀번호가 없다

### Requirement: 틀린 로그인은 계정 유무를 드러내지 않는다

틀린 비밀번호와 없는 계정은 SHALL 같은 상태 코드(401) · 같은 메시지로 거절되고 쿠키를 주지 않는다. 거절 전에 고정 지연을 두고, 없는 계정도 더미 해시로 scrypt를 돌려 걸리는 시간을 맞춘다(D8).

#### Scenario: 틀린 비밀번호는 401이고 쿠키가 없다

- **WHEN** 시드 아이디에 틀린 비밀번호로 로그인한다
- **THEN** 401이고 `Set-Cookie`가 없다

#### Scenario: 없는 계정은 틀린 비밀번호와 같은 응답이다

- **WHEN** 없는 아이디로 로그인하고, 시드 아이디에 틀린 비밀번호로 로그인한다
- **THEN** 두 응답의 상태 코드와 본문이 같다

### Requirement: /api/*는 세션이 있어야 하고 공개 조회는 열려 있다 (보호 대상)

`POST` · `DELETE /api/session`을 뺀 `/api/*`는 SHALL 유효한 세션 쿠키가 없으면(없음 · 서명 위조 · 만료) 401과 `message`를 주고 핸들러를 실행하지 않는다. `/public/*`는 세션 없이 그대로 열려 있다.

#### Scenario: 쿠키 없이 글 목록을 부르면 401이다

- **WHEN** 세션 쿠키 없이 `GET /api/posts`를 부른다
- **THEN** 401이고 본문에 `message`가 있다

#### Scenario: 서명이 위조된 쿠키는 401이다

- **WHEN** 로그인해 받은 쿠키 값의 서명 부분을 바꿔 `GET /api/posts`를 부른다
- **THEN** 401이다

#### Scenario: 만료 시각이 지난 세션은 401이다

- **WHEN** 로그인한 뒤 세션 수명보다 시계가 더 흐른 시점에 그 쿠키로 `GET /api/posts`를 부른다
- **THEN** 401이다

#### Scenario: 공개 조회는 세션 없이 200이다

- **WHEN** 세션 쿠키 없이 `GET /public/posts`를 부른다
- **THEN** 200이다

### Requirement: 로그아웃하면 쿠키가 지워진다

`DELETE /api/session`은 SHALL 204와 세션 쿠키를 지우는 `Set-Cookie`(`Max-Age=0`)를 준다. 세션이 없어도 같은 응답이다(지울 것이 없을 뿐 실패가 아니다).

#### Scenario: 로그아웃 뒤 브라우저가 가진 쿠키로는 들어갈 수 없다

- **WHEN** 로그인 → `DELETE /api/session` → 응답의 `Set-Cookie`를 적용한 쿠키 상태로 `GET /api/posts`
- **THEN** 로그아웃은 204이고 목록은 401이다

#### Scenario: 세션 없이 로그아웃해도 204다

- **WHEN** 세션 쿠키 없이 `DELETE /api/session`을 부른다
- **THEN** 204이고 `Set-Cookie`에 `Max-Age=0`이 있다

실패 의미론: (1) 서명 쿠키는 서버에 저장하지 않으므로, 로그아웃 전에 복사해 둔 쿠키 값은 만료 시각까지 유효하다(1단계 본인용 수용 — 무효화 목록은 계정이 늘 때). (2) `SESSION_SECRET`을 바꾸면 모든 세션이 끊긴다(강제 로그아웃 수단). (3) 세션이 끊겨도 이미 저장된 글에는 영향이 없다.

### Requirement: 로컬 진입점은 평문 비밀번호 env로 시드 계정을 만든다

로컬 진입점의 env 해석은 SHALL 시드 아이디를 `ADMIN_USERNAME`(없으면 `admin`)에서 읽고, 비밀번호를 `ADMIN_PASSWORD`(평문 — 시작할 때 scrypt로 해시) 또는 `ADMIN_PASSWORD_HASH` 중 정확히 하나에서 받는다. 둘 다 있거나 둘 다 없거나 해시 형식이 틀리면 이유를 말하며 시작하지 않는다. 평문의 길이는 검사하지 않는다(루프백 전용). `SESSION_SECRET`이 없으면 무작위 비밀을 만들고 그렇게 했다고 알린다. 계정 행에는 해시만 들어간다. 로컬 진입점은 레포 루트 `.env`가 있으면 먼저 읽되 셸에 이미 있는 값이 이기고, 없으면 조용히 넘어간다. 비밀번호에는 코드 기본값이 없다.

#### Scenario: 평문 비밀번호로 시드 계정이 만들어진다

- **WHEN** `ADMIN_PASSWORD=1234`만 주고 env를 해석한다
- **THEN** 아이디는 `admin`이고, 계정의 해시는 `1234`로 검증되며 해시 문자열에 `1234`가 없고, 비밀을 만들었다는 표시가 있다

#### Scenario: 평문과 해시를 둘 다 주면 시작하지 않는다

- **WHEN** `ADMIN_PASSWORD`와 `ADMIN_PASSWORD_HASH`를 둘 다 주고 env를 해석한다
- **THEN** 두 이름을 말하는 오류로 멈춘다

#### Scenario: 비밀번호가 없으면 시작하지 않는다

- **WHEN** `ADMIN_PASSWORD`도 `ADMIN_PASSWORD_HASH`도 없이 env를 해석한다
- **THEN** 두 이름을 말하는 오류로 멈춘다

#### Scenario: 빈 평문은 값이 없는 것으로 보고 해시를 쓴다

- **WHEN** `ADMIN_PASSWORD=""`와 올바른 `ADMIN_PASSWORD_HASH`를 주고 env를 해석한다
- **THEN** 계정의 해시는 준 해시 그대로다

#### Scenario: 형식이 틀린 해시로는 시작하지 않는다

- **WHEN** `ADMIN_PASSWORD_HASH="garbage"`를 주고 env를 해석한다
- **THEN** 해시 형식 오류로 멈춘다

#### Scenario: 준 SESSION_SECRET은 그대로 쓴다

- **WHEN** `ADMIN_PASSWORD`와 `SESSION_SECRET`을 주고 env를 해석한다
- **THEN** 세션 비밀은 준 값이고 비밀 생성 표시가 없다

#### Scenario: 공백뿐인 아이디는 기본값이 된다

- **WHEN** `ADMIN_USERNAME="  "`과 `ADMIN_PASSWORD`를 주고 env를 해석한다
- **THEN** 아이디는 `admin`이다
