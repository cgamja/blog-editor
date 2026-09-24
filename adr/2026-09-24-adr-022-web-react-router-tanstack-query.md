# ADR-022. web은 React Router 8(데이터 라우터) · TanStack Query 5를 정확히 고정해 쓰고, msw · Tailwind는 아직 들이지 않는다

- 날짜: 2026-09-24
- 상태: 승인됨
- 원천: 이슈 #93 · web-scaffold change(design.md) · adr-006(React + Vite SPA · React Router · TanStack Query) · adr-009(경계) · adr-019(React · Vite 버전)

## 문제 (맥락)

M3 백오피스 화면(로그인 · 글 목록 · 편집 · AI 연결 · 설정)이 설 `apps/editor/web` 패키지가 없다. adr-006이 라이브러리 종류(React Router · TanStack Query)는 정했지만 버전 · 라우터 방식 · 테스트 경계 mock(msw) · CSS 방식(Tailwind)은 실제로 들일 때 정하기로 남겨 두었다. 화면 이슈들이 병렬로 붙기 전에 이것을 한 번에 고정한다.

## 결정

- **react-router 8.4.0**을 정확히 고정한다. 데이터 라우터(`createBrowserRouter` + `react-router/dom`의 `RouterProvider`, https://reactrouter.com/start/data/installation)로 쓴다 — 라우트마다 `errorElement`로 오류 경계를 한 곳에 두고, 인증은 loader가 아니라 레이아웃 컴포넌트(`RequireSession`)가 맡는다(화면 이슈들이 loader를 자유롭게 쓰게).
- **@tanstack/react-query 5.103.2**를 정확히 고정한다. 401(`UnauthorizedError`)은 재시도하지 않는다. 세션은 쿼리 하나(`["session"]`)로 읽고 로그인 · 로그아웃이 무효화한다.
- react · react-dom 19.3.0 · vite 8.3.0 · `@vitejs/plugin-react` 6.1.1 · `@types/react(-dom)` 19.3.0은 **editor-react와 같은 버전** — React 인스턴스가 한 벌이어야 한다(adr-019 재검토 조건). `pnpm why react`로 한 벌을 확인했다.
- **msw는 아직 들이지 않는다.** 지금 web 테스트는 순수 함수(세션 판정 · next 경로 · 토큰)뿐이라 네트워크 경계 mock이 필요 없다(CLAUDE.md "경계 mock(msw)"은 경계를 mock할 때의 도구 선택이다).
- **Tailwind는 아직 들이지 않는다 — adr-006의 "CSS는 TailwindCSS 4 + `cn`" 줄을 이 ADR이 대체한다.** editor-react가 이미 토큰 CSS 변수 + 일반 CSS 파일로 쓰고 있다(#74 · #89 등). web만 Tailwind로 가면 한 화면 안에서 두 방식이 섞인다. web도 `src/styles/tokens.css`(design/tokens.json에서 생성, 테스트로 동기화) + 일반 CSS로 시작한다.
- lockfile에 새로 들어오는 패키지 5개(직접 2 · 전이 3)는 아래 검진대로 받아들인다.

### LIBRARY 2단계 검진

| 항목        | 결과                                                                                                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사용 규모   | 주간 다운로드(npm, 2026-09-15~21): react-router 약 4,000만 · @tanstack/react-query 약 4,800만                                                                                                                                                                               |
| 유지 상태   | react-router 8.4.0(2026-09-15) · @tanstack/react-query 5.103.2(2026-09-21) — 둘 다 몇 주 간격으로 나온다. 공개 뒤 하루 넘게 지났다(pnpm 공급망 정책 통과, 우회 없음)                                                                                                        |
| 라이선스    | 모두 MIT(전이 의존성 포함)                                                                                                                                                                                                                                                  |
| 타입        | 둘 다 `.d.ts` 포함                                                                                                                                                                                                                                                          |
| 모듈 형식   | 둘 다 ESM 제공                                                                                                                                                                                                                                                              |
| 번들 · 크기 | unpacked: react-router 약 2.9MB(개발 · 프로덕션 빌드 · RSC 진입점 포함) · @tanstack/react-query 약 1.7MB · query-core 약 3.2MB. 실제 번들은 web 빌드에서 잰다                                                                                                               |
| 전이 의존성 | lockfile에 새로 들어온 것: `@tanstack/query-core` 5.103.2 · `@remix-run/route-pattern` 0.22.1(2026-06-05) · `cookie-es` 3.1.1(2026-03-27). react · react-dom은 한 벌을 공유한다. react-router는 Node ≥ 22.22.0을 요구한다 — 레포 `engines`(≥22)와 로컬 Node 26에서 문제없다 |
| 대안        | 버린 대안 절                                                                                                                                                                                                                                                                |
| 보안        | `pnpm audit --prod` 알려진 취약점 없음(2026-09-24) · 정확 고정이라 패치는 사람이 올린다                                                                                                                                                                                     |

## 버린 대안

- **React Router 선언형(`<BrowserRouter>` + `<Routes>`)**: 오류 경계 · loader를 쓰려면 결국 데이터 라우터로 옮겨야 한다. 처음부터 데이터 라우터로 둔다.
- **TanStack Router**: 타입 안전한 경로가 장점이지만 adr-006이 React Router로 정했고, 화면이 여섯이라 이득이 작다. 라우터 교체 비용만 생긴다.
- **fetch + useEffect로 서버 상태 직접 관리**: 409 · 무효화 · 재시도를 화면마다 다시 짠다. adr-006의 이유 그대로 TanStack Query를 쓴다.
- **msw를 지금 들이기**: 쓸 테스트가 없다. 들일 이유가 생길 때(재검토 조건) 들인다.
- **Tailwind 4(adr-006 원안)**: editor-react와 CSS 방식이 갈린다. 두 패키지를 함께 Tailwind로 옮기는 것은 이 이슈 범위를 넘는다.

## 감수한 트레이드오프

- react-router 8은 RSC · 프레임워크 모드 코드까지 한 패키지에 담아 unpacked가 크다. 트리 셰이킹으로 번들에는 데이터 라우터만 들어간다고 보고, web 빌드 크기로 확인한다.
- msw가 없어 화면 컴포넌트의 API 흐름은 자동 테스트가 없다. 지금은 실브라우저 스모크(로컬 API)에 기댄다.
- Tailwind 없이 일반 CSS를 쓰니 유틸리티 조합이 없다. 대신 토큰 CSS 변수 하나로 editor-react와 같은 규칙을 쓴다.
- 정확 고정이라 보안 패치는 사람이 올린다.

## 재검토 조건

- 화면 이슈에서 API 흐름(409 · 401 · 업로드 실패)을 자동 테스트해야 할 때 — msw(또는 fetch 경계 가짜)를 들인다.
- CSS 파일이 화면마다 커져 규칙이 흐트러질 때 — editor-react와 함께 Tailwind(또는 CSS Modules)로 옮길지 본다.
- react-router 9 · TanStack Query 6이 나와 API가 바뀔 때.
- web 빌드 번들이 로그인 뒤 첫 화면 기준으로 과하게 클 때 — 라우트별 코드 분할(`lazy`)을 넣는다.
