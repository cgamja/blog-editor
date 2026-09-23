# Design — api-session (이슈 #23)

plan 3-5 · D8 · D13 · adr-007 그대로: scrypt 해시 + HMAC 서명 쿠키 + 계정 테이블 구조(1단계 1행). 새 의존성 없음 — `node:crypto`(`scrypt` · `randomBytes` · `timingSafeEqual`)와 Hono 내장 `hono/cookie`(`setSignedCookie` · `getSignedCookie` · `deleteCookie`, HMAC-SHA256).

## 결정

### 1. 계정 테이블은 계약 + 메모리 구현만

- 가정: `AccountStore.findByEmail(email) → { id, email, passwordHash, workspaceId } | null`. 구현은 `createMemoryAccountStore(rows)` 하나, 로컬 진입점이 env의 시드 1행을 넣는다
- 근거: D13 "로그인을 비밀번호 하나가 아니라 계정 테이블 구조로(1단계 1행)". 저장 백엔드(DynamoDB · S3)는 plan 10의 미결 스파이크라 M4에서 같은 계약으로 붙인다
- 되돌리는 비용: 계약 모양 변경 — 호출자는 `app.ts` 한 곳

### 2. email은 소문자로 맞춰 찾는다

- 가정: 로그인 입력과 시드 모두 앞뒤 공백을 빼고 소문자로 비교
- 근거: 사람이 손으로 치는 값이고 대소문자 차이로 "없는 계정"이 되면 원인을 찾기 어렵다
- 되돌리는 비용: 한 줄

### 3. 해시 형식은 자기기술 문자열

- 가정: `scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>`, 기본 N=2^15 · r=8 · p=1 · salt 16바이트 · 키 32바이트. 검증은 문자열의 파라미터로 다시 계산해 `timingSafeEqual`
- 근거: 파라미터를 올려도 옛 해시가 계속 검증된다. 테스트는 낮은 N으로 해시를 만들어 빠르다
- 사람이 해시를 만드는 방법: `node apps/editor/api/src/hash-password.ts` — 비밀번호를 표준 입력으로 받아 해시를 출력(쉘 이력에 비밀번호가 남지 않게 인자로 받지 않는다). package.json 스크립트는 보호 파일이라 더하지 않았다
- 되돌리는 비용: 형식 바꾸면 시드 해시 재생성 1회

### 4. 세션 쿠키 값 = `<accountId>.<만료 epoch 초>`, 서명은 Hono

- 가정: 쿠키 이름 `session`, 수명 기본 7일(`sessionTtlSeconds`), `Max-Age`와 값 안의 만료 시각이 같다. 서버는 서명 검증 뒤 만료 시각을 `now()`와 비교하고, 계정이 테이블에 아직 있는지는 보지 않는다(1행 시드라 이득 없음 — 계정 삭제가 생기면 다시 본다)
- 근거: `Max-Age`는 브라우저가 지키는 것이라 복사된 쿠키에는 효력이 없다. 서명된 값 안의 만료가 서버의 진짜 만료다
- 시계는 `createApp`의 `now` 옵션(기본 `Date.now`)으로 주입해 만료 시나리오를 결정적으로 테스트한다
- 되돌리는 비용: 쿠키 값 모양 — 바꾸면 기존 세션이 모두 끊길 뿐

### 5. 실패 지연은 옵션, 기본 1초

- 가정: `loginFailureDelayMs` 기본 1000, 테스트는 0. 없는 계정도 모듈 상수인 더미 해시(기본 파라미터)로 scrypt를 돌린다
- 근거: D8 ③ "scrypt 해시 + 실패 시 고정 지연". 긴 무작위 비밀번호가 방어의 핵심이고 지연은 보조
- 되돌리는 비용: 숫자 하나

### 6. `sessionSecret`은 32바이트 이상, 아니면 `createApp`이 throw

- 근거: HMAC-SHA256 키로 짧은 값은 무차별 대입 표면이다. 설정 실수는 시작 시점에 드러나야 한다
- 로컬 진입점은 `SESSION_SECRET` · `ADMIN_EMAIL` · `ADMIN_PASSWORD_HASH` 중 하나라도 없으면 시작하지 않고 무엇이 빠졌는지 말한다

### 7. 루프백 바인딩은 유지

- 가정: `127.0.0.1` 그대로. 이유가 "인증 없음"에서 "TLS 없는 로컬 개발 서버(`Secure` 쿠키 · 평문 비밀번호)"로 바뀐다
- 되돌리는 비용: 한 줄

### 8. `/api/session` DELETE는 세션 없이도 204

- 근거: 로그아웃은 멱등이어야 화면(M3)이 만료된 세션에서 로그아웃을 눌러도 오류가 안 난다
