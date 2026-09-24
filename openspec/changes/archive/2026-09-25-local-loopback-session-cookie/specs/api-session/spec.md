## MODIFIED Requirements

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

## ADDED Requirements

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
