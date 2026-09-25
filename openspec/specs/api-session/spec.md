# api-session Specification

## Purpose

에디터 API의 로그인(plan 3-5 · D8 · D13) — 계정 테이블의 scrypt 해시로 비밀번호를 확인하고 HMAC 서명 세션 쿠키를 준다. `/api/*`는 세션 없이는 401이고, `/public/*`는 공개 그대로다.

## Requirements

### Requirement: 계정 테이블의 비밀번호로 로그인하면 서명 세션 쿠키를 받는다

`POST /api/session`은 SHALL 본문 `{ username, password }`를 계정 테이블(1단계 시드 1행)의 scrypt 해시와 비교하고, 맞으면 204와 HMAC 서명 세션 쿠키를 준다. 아이디는 앞뒤 공백을 빼고 대소문자를 무시해 찾는다. 쿠키는 기본(배포) 모드에서 이름 `__Host-session`이고 `HttpOnly` · `Secure` · `SameSite=Strict` · `Path=/` · `Max-Age`를 갖는다(로컬 루프백 모드는 아래 요구사항). 서명된 값 안에도 만료 시각이 있어 서버가 따로 검사한다. 본문이 JSON이 아니거나 모양이 다르면 400이다.

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

### Requirement: 연속 실패가 쌓이면 로그인을 잠근다 (보호 대상)

로그인 확인(`POST /api/session`과 OAuth `POST /authorize`가 같은 함수를 쓴다)은 SHALL 한 계정에 연속 5회 실패하면 그 계정을 15분 동안 잠근다. 잠긴 동안에는 비밀번호가 맞아도 틀린 로그인과 같은 응답(401 · 같은 메시지 · 같은 화면)이다. 없는 아이디는 모두 한 묶음으로 세어 잠금으로도 계정 유무가 드러나지 않는다. 성공하면 그 계정의 연속 실패는 0이 된다. 요청마다 두는 고정 지연은 병렬 요청을 막지 못해서 이 카운터가 무차별 대입의 상한이다(D8 재검토 조건 — 짧은 비밀번호로 터널을 열 때).

#### Scenario: 5회 실패 뒤에는 맞는 비밀번호도 거부된다

- **WHEN** 시드 아이디에 틀린 비밀번호로 5번 로그인한 뒤 맞는 비밀번호로 로그인한다
- **THEN** 401이고 `Set-Cookie`가 없다

#### Scenario: 잠금은 15분 뒤 풀린다

- **WHEN** 5번 실패해 잠긴 뒤 시계가 15분 넘게 흐르고 맞는 비밀번호로 로그인한다
- **THEN** 204다

#### Scenario: 없는 아이디의 실패는 실제 계정을 잠그지 않는다

- **WHEN** 없는 아이디로 5번 실패한 뒤 시드 아이디 · 맞는 비밀번호로 로그인한다
- **THEN** 204다

실패 의미론: 카운터는 메모리에 있어 재시작하면 초기화된다. 아이디를 아는 사람은 5번 틀려 그 계정을 15분씩 거듭 잠글 수 있다(서비스 거부 비용을 받아들인다) — 터널로 공개할 때는 추측하기 어려운 `ADMIN_USERNAME`과 긴 비밀번호를 쓴다. 영속 카운터(DynamoDB)는 M4(#33).

### Requirement: 세션 확인은 세션이 있을 때만 204다

`GET /api/session`은 SHALL 유효한 세션 쿠키가 있으면 본문 없는 204를, 없거나 만료 · 위조면 401과 `message`를 준다. 이 경로는 세션 없이 열리는 메서드(로그인 POST · 로그아웃 DELETE)에 들지 않는다.

#### Scenario: 세션이 있으면 204

- **WHEN** 로그인한 쿠키로 `GET /api/session`을 부른다
- **THEN** 204이고 본문이 비어 있다

#### Scenario: 세션이 없으면 401

- **WHEN** 세션 쿠키 없이 `GET /api/session`을 부른다
- **THEN** 401이고 `message`가 있다

### Requirement: 로컬 루프백 http 진입점은 접두사 · Secure 없는 세션 쿠키를 쓴다

로컬 진입점(127.0.0.1에만 묶인 http)은 SHALL `PUBLIC_BASE_URL`이 없으면 세션 쿠키를 루프백 모드로 준다 — 이름 `session`, `__Host-` 접두사와 `Secure` 없이 `HttpOnly` · `SameSite=Strict` · `Path=/`를 갖는다. Safari · WebKit이 http 루프백에서 Secure 쿠키를 저장하지 않기 때문이다(adr-026). 세션 확인 · 로그아웃 · OAuth authorize가 같은 이름을 읽고 지운다. `PUBLIC_BASE_URL`(공개 https 터널)이 있으면 배포와 같은 기본 모드다. 모드를 넘기지 않은 앱(배포 진입점)은 기본 모드다.

#### Scenario: 루프백 모드 로그인 쿠키

- **WHEN** 루프백 http 모드 앱에 시드 계정으로 로그인한다
- **THEN** 204이고 `Set-Cookie`가 `session=`으로 시작하며 `Secure`가 없고 `HttpOnly` · `SameSite=Strict` · `Path=/`가 있다

#### Scenario: 루프백 모드 쿠키로 인증된다

- **WHEN** 루프백 http 모드에서 받은 쿠키로 `GET /api/posts`를 부른다
- **THEN** 200이다

#### Scenario: 모드가 다른 세션 쿠키로는 들어갈 수 없다

- **WHEN** 같은 비밀의 루프백 모드 앱에서 받은 `session` 쿠키를 기본 모드 앱에, 기본 모드 앱에서 받은 `__Host-session` 쿠키를 루프백 모드 앱에 보내 `GET /api/posts`를 부른다
- **THEN** 둘 다 401이다

#### Scenario: 루프백 모드 로그아웃

- **WHEN** 루프백 http 모드 앱에 `DELETE /api/session`을 부른다
- **THEN** 204이고 `Set-Cookie`가 `session=`으로 시작하며 `Max-Age=0`이 있다

#### Scenario: 터널 주소가 없으면 루프백 모드

- **WHEN** 로컬 진입점 env에 `PUBLIC_BASE_URL`이 없다
- **THEN** 세션 쿠키 모드는 `loopback-http`다

#### Scenario: 터널 주소가 있으면 기본 모드

- **WHEN** 로컬 진입점 env에 `PUBLIC_BASE_URL`(https 터널)이 있다
- **THEN** 세션 쿠키 모드는 `secure`다
