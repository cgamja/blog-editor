# local-loopback-session-cookie (이슈 #118)

## Why

Safari · WebKit은 http 루프백(`127.0.0.1` · `localhost`)을 안전한 출처로 보지 않아 Secure 쿠키를 저장하지 않는다. 세션 쿠키가 `__Host-session`(Secure 필수)이라 로컬 서버에서 Safari로 로그인할 수 없고, #44 Safari 체크리스트와 실브라우저 층의 WebKit 프로젝트(adr-024에서 뺐다)가 막혀 있다.

## What Changes

- 세션 설정에 쿠키 모드: `secure`(기본 · 배포 — 지금 그대로 `__Host-session` + Secure) / `loopback-http`(이름 `session`, `__Host-` · Secure 없음, HttpOnly · SameSite=Strict · Path=/는 같다). 쓰기 · 읽기 · 로그아웃 · OAuth authorize의 세션 확인이 같은 모드를 쓴다
- 로컬 진입점(serve.ts, 127.0.0.1에만 묶임)만 `loopback-http`를 넘긴다. `PUBLIC_BASE_URL`(공개 https 터널)이 있으면 `secure`로 둔다
- Playwright 설정에 WebKit 프로젝트를 다시 켠다(CI도 WebKit을 받는다)
- 결정 기록: adr-026

## Impact

- 배포 쿠키 속성 · openapi 계약의 쿠키 이름(`__Host-session`)은 바뀌지 않는다 — 기존 보안 테스트는 그대로 통과한다
- 로컬 서버를 쓰던 Chrome 사용자는 한 번 다시 로그인한다(쿠키 이름이 바뀜)
- 하지 않는 것: 로컬 https(자체 서명 인증서) · 실제 Safari 앱 재현(사람 몫, #44)
