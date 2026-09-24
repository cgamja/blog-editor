# ADR-024. 실브라우저 테스트 층을 Playwright(Chromium)로 두고 `pnpm verify`에 넣는다

- 날짜: 2026-09-25
- 상태: 제안됨 (PR 머지 = 승인)

## 문제 (맥락)

plan 05는 실브라우저 층을 Playwright(Chromium · WebKit)로 정했지만 만들지 않았다(`tests.layers.browser: null`). 그동안 화면 버그를 자동 테스트가 하나도 잡지 못했다.

- #108: 새 글 화면을 주소로 열면 에디터가 파기되어 에러 경계로 떨어졌다
- #107: 대화상자가 열리는 순간 제목 글꼴 조각이 아직 받아지지 않았다

두 버그 모두 사람이 브라우저에서 보고 찾았다. 순수 함수 층(Vitest node)은 렌더 양보 · 라우터 · 쿠키 · 네트워크를 원리적으로 볼 수 없다. 사용자는 2026-09-25에 이 층을 추가하기로 결정했다(#114).

## 결정

- `@playwright/test` **1.63.0**을 정확한 버전으로 고정한다(루트 devDependency). 설정은 루트 `playwright.config.ts`, 시나리오는 `e2e/*.spec.ts`, 지원 파일은 `e2e/*.test.helpers.ts`다.
- 실행 한 번마다 api와 web dev 서버를 Playwright `webServer`로 띄운다. 이 서버들은 다음 조건을 지킨다.
  - 계정은 테스트 전용(`e2e`)이다. 사람의 `.env` 계정은 쓰지 않는다.
  - 저장 루트는 worktree마다 하나(`$TMPDIR/blog-editor-e2e-<경로 해시>`)이고, 띄울 때마다 비운다.
  - 포트는 `E2E_WEB_PORT` · `E2E_API_PORT`로 받는다. 값이 없으면 빈 포트를 골라 env에 적고, 워커 프로세스가 같은 값을 물려받는다. 병렬 worktree의 verify가 동시에 돌아도 부딪히지 않는다.
  - `reuseExistingServer: false`로 둔다. 사람의 dev 서버(다른 계정 · 다른 저장소)에 붙으면 결과가 조용히 틀리기 때문이다.
- **브라우저는 이번에 Chromium만 둔다.** WebKit은 아래 "버린 대안"의 실측 때문에 뺐다(#118).
- **`pnpm verify`에 넣는다**(`pnpm test` 다음, `test:e2e`). 이슈의 기준은 "Chromium 스모크가 30초 이하"였고, 실측은 이렇다.
  - 3개 시나리오의 러너 보고는 4.9~5.1초다.
  - 서버 기동을 포함한 벽시계 시간은 vite 캐시가 있을 때 5.7초, `node_modules/.vite`를 지운 뒤 5.8초다(Apple Silicon 로컬 기준).
  - 그래서 pre-push와 CI가 같은 한 줄로 돌린다. CI는 Chromium을 Playwright 버전별로 캐시하고, 실패하면 trace를 올린다.
- `pnpm typecheck`가 루트 파일도 검사한다. 루트 도구(`tsconfig.json`, vitest 전역 타입)와 e2e(`tsconfig.e2e.json`, node 타입만 — `expect`를 import하지 않으면 타입 오류로 잡힌다)를 나눈다. 이전에는 루트 파일을 아무 명령도 타입 검사하지 않았다.

### LIBRARY 게이트

0단계 판정: WEB-SPEC(E2E)에 이미 있다. 스펙이 Cypress를 버린 대안으로 적어 두었다. CLAUDE.md 규칙("예외 없음")에 따라 아래 표를 남긴다.

| 항목        | 확인                                                                                                                             | 판정      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 유지보수    | 1.63.0이 2026-09-04에 릴리스됐다. microsoft/playwright, next 태그가 매일 나온다                                                  | 통과      |
| 사용 규모   | 주간 44.4M. 대안 Cypress는 4.6M(npm API, 2026-09-15~21)                                                                          | 통과      |
| 번들 크기   | devDependency라 배포 번들에 들어가지 않는다. 브라우저 파일은 로컬 캐시에 받는다(WebKit 78MB, Chromium 1243은 이미 캐시에 있었다) | 해당 없음 |
| 전이 의존성 | `playwright` → `playwright-core` 두 개뿐이다(lockfile +28줄)                                                                     | 통과      |
| 보안        | `pnpm audit`에서 권고 0건이다                                                                                                    | 통과      |
| 타입        | TS를 내장한다                                                                                                                    | 통과      |
| 모듈 형식   | ESM 설정을 받는다. 설정 파일의 top-level await로 빈 포트를 고르는 것까지 실측으로 확인했다                                       | 통과      |
| 라이선스    | Apache-2.0                                                                                                                       | 통과      |

## 버린 대안

- **WebKit 프로젝트를 같이 두기(plan 05 원안)**: 실측(Playwright 1.63 · WebKit 26.6)에서 로그인이 되지 않았다.
  - `POST /api/session`은 204를 돌려주고 `Set-Cookie: __Host-session=…; Secure; HttpOnly; SameSite=Strict`를 싣는다. 그런데 `context.cookies()`는 `[]`이고, 바로 이어지는 `GET /api/posts`가 401이다. `http://127.0.0.1`과 `http://localhost` 모두 같다.
  - Chromium은 http 루프백을 안전한 맥락으로 보고 Secure 쿠키를 저장하지만 WebKit은 저장하지 않는다.
  - 로그인이 필요한 시나리오를 WebKit에서만 빼는 설정은 사실상 skip이라 두지 않았다. 해결(로컬 https 또는 루프백 쿠키 정책)은 #118에서 결정한다.
- **Cypress**: WEB-SPEC이 이미 버렸다(멀티탭 · 병렬 제약). 두 탭 409 시나리오(plan 05)가 멀티탭이다.
- **jsdom + Testing Library**: plan 05가 적었듯 contentEditable은 jsdom에서 제대로 돌지 않는다. #108은 실제 렌더 양보에서만 났다. 새 의존성 둘을 더해도 이 층이 잡아야 할 것을 잡지 못한다.
- **`pnpm test:e2e`만 따로 두고 CI에서만 돌리기**: 6초 비용을 아끼는 대신, 워커 · 사람이 push 전에 화면 회귀를 못 본다. 30초를 넘으면 이 안으로 옮긴다(재검토 조건).
- **고정 기본 포트**: 워커 세 개가 동시에 verify를 돌리면 부딪힌다. 빈 포트를 고르는 비용은 설정 20줄이다.
- **`page.request`로 글을 미리 만들기**: 세션 쿠키가 Secure라 http 루프백에서 요청 컨텍스트가 쿠키를 싣지 않았다(401 실측). 그래서 페이지 안의 `fetch`로 만든다.

## 감수한 트레이드오프

- verify가 약 6초 길어지고, 새로 clone한 뒤 한 번은 `pnpm exec playwright install chromium`이 필요하다(CLAUDE.md 명령 절). 브라우저가 없으면 verify가 실패하므로 조용히 건너뛰지 않는다.
- Safari 계열 회귀는 여전히 사람 몫이다(#44 체크리스트). #118이 풀릴 때까지다.
- 서버를 테스트마다가 아니라 실행마다 한 번 띄우므로, 시나리오끼리 한 저장소를 나눠 쓴다. 그래서 테스트는 자기 글 주소를 따로 쓴다(프로젝트 · 재시도 이름을 넣는다).
- 한 worktree에서 두 번 동시에 돌리면 저장 루트가 겹친다. 그런 실행 경로는 없다.

## 재검토 조건

- #118(로컬 http에서 WebKit Secure 쿠키)이 풀리면 WebKit 프로젝트를 더한다(plan 05 원안).
- verify 안 `test:e2e`가 30초를 넘으면 별도 명령 + CI 필수 job으로 옮긴다.
- 이 층의 테스트가 한 주에 두 번 flaky하면 원인(대기 · 포트 · 저장소 공유)을 먼저 고치고, 못 고치면 verify에서 뺀다.
- M4 배포 뒤 https 스테이징이 생기면 WebKit은 그쪽에서 도는 것을 검토한다.
