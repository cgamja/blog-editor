# design — web-scaffold

## 1. 세션 판정

지금 API에는 "세션 확인" 전용 엔드포인트가 없다. `/api/*`는 `requireSession`이 세션이 없으면 401을 준다. 그래서 세션 확인은 가장 가벼운 읽기 `GET /api/posts`의 **상태 코드**로 한다 — 2xx면 로그인됨, 401이면 로그인 필요, 그 밖은 오류(가드가 판정하지 못함 → 오류 화면).

- 판정 규칙은 DOM 없는 `sessionStateOf(status)` 하나에 둔다(Vitest node).
- 확인 경로는 상수 `SESSION_PROBE_PATH` 한 곳. #94(`/api` 계약)가 `GET /api/session`을 만들면 이 상수만 바꾼다.

## 2. 로그인 뒤 돌아갈 곳(`next`)

가드는 `/login?next=<지금 경로>`로 보낸다. 로그인 성공 뒤 `next`로 이동하는데, 이 값은 주소창에서 누구나 바꿀 수 있으므로 **이 앱 안의 경로만** 받는다(`safeNextPath`).

- `/`로 시작하고 `//` · `/\`로 시작하지 않을 것(다른 출처로 가는 프로토콜 상대 주소 차단)
- 제어 문자 없음, `/login` 자신은 안 됨(되돌이 고리 — 라우터처럼 대소문자를 가리지 않는다)
- 어기면 `/`

## 3. 라우터 · 데이터

- React Router의 데이터 라우터(`createBrowserRouter` · `RouterProvider`) — 라우트마다 `errorElement`로 오류 경계를 한 곳에 둔다. 가드는 로그인 필요 라우트를 감싸는 레이아웃 컴포넌트(TanStack Query로 세션을 읽는다)로, loader에 인증을 섞지 않는다(화면 이슈들이 loader를 자유롭게 쓰게).
- 세션 쿼리(`staleTime: Infinity`)는 무효화하지 않고 **직접 쓴다**(`features/auth/session-cache.ts`):
  - 로그인 성공 → `markSignedIn`(`'authenticated'`) 뒤 `next`로 이동. `invalidateQueries`는 로그인 화면처럼 세션을 보는 곳이 없으면 다시 묻지 않아(기본 `refetchType: 'active'`) 가드가 남은 `'anonymous'`로 되돌린다(PR #100 리뷰 블로커).
  - 어느 쿼리 · mutation이든 401 → `QueryCache` · `MutationCache` 전역 `onError`가 `markSessionExpired`(`'anonymous'`). 가드가 `next`를 붙여 로그인 화면으로 보낸다.
- 401은 재시도하지 않는다(재시도해도 결과가 같다). 그 밖의 오류는 TanStack Query 기본값대로 3번까지.
- 요청은 같은 출처(`credentials: "same-origin"`, 기본값). 화면의 API 호출은 `shared/api/http.ts`의 `apiRequest`를 거친다 — 401은 `UnauthorizedError`, 그 밖의 실패는 `ApiError`(본문 `message`를 `userMessage`로). 세션 확인만은 401도 답이라 `fetch` 상태 코드를 그대로 판정한다.
- 로그아웃은 쓰는 화면이 없어 두지 않는다.

## 3-1. 폴더

`src/app`(main · router · query-client) → `src/features/<기능>`(api · components · hooks · pages · constants · types · `index.ts` 공개 목록) → `src/shared`(api · routes · messages). `src/pages`는 기능에 속하지 않는 화면(404 · 오류 · 자리 표시). `shared`는 `features`를 import하지 않는다.

## 3-2. 개발 서버(행동이 아닌 제약)

Vite 개발 서버는 `PORT` 환경 변수가 없거나 1~65535 정수가 아니면 시작하지 않고, 포트가 잡혀 있으면 옆 포트로 옮기지 않는다(`strictPort` — 병렬 worktree에서 증거 캡처가 엉뚱한 포트를 때리지 않게). `127.0.0.1`에만 연다. `/api` · `/images` · `/public`은 `127.0.0.1:8787`(또는 `API_PORT`)로 넘겨 같은 출처 세션 쿠키가 그대로 간다. 자동 테스트는 없고 실브라우저 스모크가 이 설정 위에서 돈다.

## 4. 토큰

`design/tokens.json`을 순수 함수 `tokensToCss`로 `:root` 변수로 바꾸고, 생성 스크립트가 `src/styles/tokens.css`에 쓴다. 테스트가 "지금 tokens.json으로 만든 결과 = 저장된 tokens.css"를 확인해 둘이 어긋나면 `pnpm verify`가 빨개진다(별도 docs:check 단계를 만들지 않는다).

- 색 `color.<이름>` → `--<이름>`(editor-react · content-render CSS가 이미 이 이름을 쓴다)
- 글꼴 `font.body/display/hand` → `--font-sans` · `--font-display` · `--font-hand`
- 크기 `size.*` 중 px 길이 → `--<이름>`(rem 변환). px 길이가 아닌 값(focus-ring 설명 등)은 건너뛴다
- `--brand`는 post.css가 쓰는 사이트 쪽 이름이라 `--brand-ink`의 별칭으로 둔다

## 5. 버린 것

- msw: 지금 테스트는 순수 함수와 node QueryClient뿐이고, 요청 도우미 테스트만 `fetch`를 `vi.stubGlobal`로 바꾼다. DOM 테스트 환경도 없어 라우터 통합 테스트(createMemoryRouter)는 두지 않고 실브라우저 스모크가 맡는다. 화면 이슈에서 통합 테스트가 생길 때 ADR-022의 재검토 조건으로 들인다.
- Tailwind(adr-006의 CSS 결정): editor-react가 이미 토큰 CSS 변수 + 일반 CSS로 쓰고 있다. 두 방식을 섞지 않고 web도 같은 방식으로 시작한다 — ADR-022에 기록.
