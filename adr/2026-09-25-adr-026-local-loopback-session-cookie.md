# ADR-026. 로컬 루프백 진입점만 `__Host-` · Secure 없는 세션 쿠키를 쓰고, 실브라우저 층에 WebKit을 다시 켠다

- 날짜: 2026-09-25
- 상태: 제안됨 (PR 머지 = 승인)

## 문제 (맥락)

세션 쿠키는 `__Host-session`이고 `Secure`다(plan 3-5 · D8). 브라우저는 `__Host-` 접두사 쿠키를 Secure일 때만 받는다. Chromium은 http 루프백(`127.0.0.1` · `localhost`)을 안전한 맥락으로 봐서 이 쿠키를 저장하지만, WebKit은 저장하지 않는다.

- 실측(Playwright 1.63 · WebKit 26.6, #114): `POST /api/session`은 204와 Set-Cookie를 주는데 `context.cookies()`가 `[]`이고, 곧이은 `GET /api/posts`가 401이다.
- 그래서 adr-024는 실브라우저 층에서 WebKit을 뺐다. 로컬 서버에서 Safari로 로그인할 수 없으니 #44 Safari 체크리스트도 진행할 수 없다.
- 실제 Safari 앱 재현은 이 PR에서 하지 못했다(자동화 권한이 없다). 같은 엔진(WebKit)의 실측을 근거로 삼고, 앱 확인은 #44에서 사람이 한다.

## 결정

- 세션 설정에 쿠키 모드를 둔다(`SessionCookieMode`).
  - `secure`: 기본이고 배포가 쓴다. 지금과 같다 — `__Host-session`, HttpOnly · Secure · SameSite=Strict · Path=/.
  - `loopback-http`: 이름은 `session`이다. `__Host-` 접두사와 Secure만 빼고 HttpOnly · SameSite=Strict · Path=/는 같다.
- 쓰기(로그인) · 읽기(`/api/*` 미들웨어 · OAuth `/authorize`) · 지우기(로그아웃)는 설정에서 한 번 정한 같은 이름 · 속성을 쓴다.
- `loopback-http`를 넘기는 곳은 로컬 진입점 `serve.ts` 하나다. 이 서버는 `127.0.0.1`에만 묶이므로 이 기기 밖에서는 닿지 않는다. 배포(Lambda, M4) 진입점은 모드를 넘기지 않아 기본값 `secure`가 된다. 모드를 정하는 규칙은 `local-config.ts`에 두고 테스트한다. `PUBLIC_BASE_URL` 해석은 OAuth를 여는 판정(`mcp/env.ts` `readIssuer`)과 같은 함수를 써서 둘이 어긋나지 않는다. 시작 로그가 지금 쿠키 모드를 한 줄로 알린다.
- **`PUBLIC_BASE_URL`이 있으면 `secure`로 둔다.** 이 값은 MCP OAuth를 claude.ai에 열려고 공개 https 터널을 붙일 때 쓴다. 그때 이 서버는 공개 https 출처로도 닿으므로 "이 기기만 닿는다"는 전제가 깨진다. 터널 출처에서 Secure 없는 쿠키를 주면 http로 내려간 요청에 실릴 수 있다. 대가로, 터널을 켠 동안에는 로컬 Safari 로그인이 다시 안 된다(Chrome은 된다).
- openapi 계약의 쿠키 이름(`SESSION_COOKIE_NAME`)은 배포 값 `__Host-session` 그대로다.
- **adr-024의 WebKit 제외를 되돌린다.** `playwright.config.ts`에 `webkit` 프로젝트(`Desktop Safari`)를 다시 켜고, CI는 Chromium과 WebKit을 함께 받아 캐시한다. e2e의 api 서버는 `PUBLIC_BASE_URL`을 빈 값으로 덮는다 — 사람의 `.env`에 터널 주소가 있어도 WebKit이 로그인하게.

## 버린 대안

- **로컬 https(자체 서명 인증서)**: 배포와 같은 쿠키를 그대로 쓸 수 있다. 하지만 인증서를 만드는 도구(mkcert 등, 새 의존성 · LIBRARY 게이트)가 필요하다. Safari가 믿게 하려면 키체인에 루트 인증서를 넣어야 하고, 병렬 worktree · CI · Playwright 모두에 인증서 경로를 돌려야 한다. 얻는 것(로컬에서도 Secure)에 비해 설치 · 신뢰 단계가 사람과 CI 양쪽에 늘어난다.
- **요청마다 출처를 보고 모드를 고르기(Host 헤더가 루프백이면 루프백 모드)**: 터널이 Host를 어떻게 넘기는지에 따라 판정이 바뀐다. Host는 요청자가 정하는 값이라 보안 판정의 근거로 쓰지 않는다.
- **로그인이 필요한 시나리오만 WebKit에서 빼기**: 사실상 skip이다(adr-024에서도 버렸다).
- **`Secure`만 빼고 `__Host-` 접두사는 두기**: 브라우저가 Secure 없는 `__Host-` 쿠키를 거부하므로 동작하지 않는다.

## 감수한 트레이드오프

- 로컬 쿠키는 접두사 보호(상위 도메인이 같은 이름 쿠키로 가리기 방지)와 Secure가 없다. 루프백 http에는 상위 도메인도 네트워크 도청자도 없으므로 잃는 것이 없다고 본다. 같은 기기의 다른 루프백 포트 서버가 같은 이름 쿠키를 심을 수는 있다(쿠키는 포트를 가리지 않는다). 그래도 서명이 맞지 않으면 401일 뿐 세션을 빼앗지는 못한다.
- 배포와 로컬의 쿠키 이름이 다르다. 모드별 속성은 테스트가 둘 다 지키고(기존 보안 테스트는 그대로), 배포 쪽 계약 이름은 바뀌지 않는다.
- 로컬 서버를 쓰던 Chrome 사용자는 쿠키 이름이 바뀌어 한 번 다시 로그인한다.
- `PUBLIC_BASE_URL` 없이 터널을 여는 경우(docs/mcp-connect.md 2-b의 Request headers 방식)는 공개 터널 뒤인데도 루프백 쿠키다. 그 길은 `/mcp`만 Bearer 토큰으로 쓰고 웹 화면 · OAuth 로그인 페이지를 터널로 열지 않으므로, 터널 출처에 세션 쿠키가 생길 일이 거의 없어 영향이 작다고 본다.
- 로그아웃은 현재 모드의 이름만 지운다. `SESSION_SECRET`을 고정한 채 모드를 오가면(`PUBLIC_BASE_URL`을 넣었다 뺐다) 다른 이름의 옛 쿠키(수명 7일)가 브라우저에 남았다가 원래 모드로 돌아올 때 다시 유효해질 수 있다. 로컬 한정이라 감수한다. 모드가 다른 쿠키끼리는 서로 인증되지 않는다(테스트로 지킨다).
- verify의 e2e가 두 브라우저를 돈다. 시나리오 3개 × 2에서 러너 보고 약 7초(전 5초)이고, 새로 clone한 뒤 한 번 `pnpm exec playwright install chromium webkit`이 필요하다.

## 재검토 조건

- WebKit이 http 루프백을 안전한 맥락으로 보게 되면(Secure 쿠키 저장) 모드를 없애고 하나로 돌아간다.
- 로컬 서버를 루프백 밖(같은 네트워크 · 다른 기기)에 열 일이 생기면 `loopback-http`를 쓸 수 없다 — 로컬 https를 다시 본다.
- 배포 진입점이 생길 때(M4) 그 진입점이 모드를 넘기지 않는지 테스트로 지킨다 — 이 PR이 아니라 M4 배포 진입점 이슈의 몫이다.
