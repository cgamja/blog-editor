# web-scaffold (이슈 #93)

## Why

M3 백오피스 화면(로그인 · 글 목록 · 편집 · AI 연결 · 설정)이 설 자리가 없다. adr-006은 React + Vite SPA · React Router · TanStack Query로 정했지만 `apps/editor/web` 패키지와 라이브러리 버전이 아직 없다. 각 화면 이슈가 병렬로 붙을 수 있게 라우팅 · 데이터 · 인증 가드 · 토큰의 뼈대를 먼저 세운다.

## What Changes

- 새 패키지 `@blog-editor/web`(`apps/editor/web`): Vite SPA, `PORT` env 필수 + `strictPort`, `127.0.0.1`에만 연다
- 개발 프록시: `/api` · `/images` · `/public` → `127.0.0.1:8787`(로컬 API, 같은 출처라 `SameSite=Strict` 세션 쿠키가 그대로 간다). 스티커는 editor-react 플레이그라운드처럼 content-render assets를 `/stickers/`로 서빙
- 라우트 뼈대: `/login` · `/` · `/posts/new` · `/posts/:slug/edit` · `/connect` · `/settings` · 404 — 화면 내용은 자리 표시(각 화면은 별도 이슈)
- 인증 가드: 세션 확인 요청의 상태 코드로 로그인 여부를 판정. 로그인이 필요하면 `/login?next=<지금 경로>`로, 로그인하면 `next`로 돌아간다. `next`는 이 앱 안의 경로만 받는다(열린 리다이렉트 방지)
- 오류 경계 · 404 · QueryClient
- 토큰: `design/tokens.json` → `src/styles/tokens.css`(생성 스크립트 + 동기화 테스트). tokens.json 머리 주석대로 이 파일이 코드 쪽 정본
- ADR-022: React Router · TanStack Query 버전 고정과 LIBRARY 검진, msw · Tailwind를 지금 들이지 않는 이유

## Impact

- 새 의존성(사람 승인): react-router 8.4.0 · @tanstack/react-query 5.103.2. react · react-dom · vite · plugin-react · 타입은 editor-react와 같은 버전(React 한 벌)
- eslint 경계: web → editor-react · content-schema 허용 엣지가 이미 있다 — 변경 없음
- 하지 않는 것: 각 화면 내용, `/api` 계약 파일(#94), 배포(M4)
