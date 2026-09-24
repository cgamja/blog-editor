# design — web-scaffold

## 1. 세션 판정

지금 API에는 "세션 확인" 전용 엔드포인트가 없다. `/api/*`는 `requireSession`이 세션이 없으면 401을 준다. 그래서 세션 확인은 가장 가벼운 읽기 `GET /api/posts`의 **상태 코드**로 한다 — 2xx면 로그인됨, 401이면 로그인 필요, 그 밖은 오류(가드가 판정하지 못함 → 오류 화면).

- 판정 규칙은 DOM 없는 `sessionStateOf(status)` 하나에 둔다(Vitest node).
- 확인 경로는 상수 `SESSION_PROBE_PATH` 한 곳. #94(`/api` 계약)가 `GET /api/session`을 만들면 이 상수만 바꾼다.

## 2. 로그인 뒤 돌아갈 곳(`next`)

가드는 `/login?next=<지금 경로>`로 보낸다. 로그인 성공 뒤 `next`로 이동하는데, 이 값은 주소창에서 누구나 바꿀 수 있으므로 **이 앱 안의 경로만** 받는다(`safeNextPath`).

- `/`로 시작하고 `//` · `/\`로 시작하지 않을 것(다른 출처로 가는 프로토콜 상대 주소 차단)
- 제어 문자 없음, `/login` 자신은 안 됨(되돌이 고리)
- 어기면 `/`

## 3. 라우터 · 데이터

- React Router의 데이터 라우터(`createBrowserRouter` · `RouterProvider`) — 라우트마다 `errorElement`로 오류 경계를 한 곳에 둔다. 가드는 로그인 필요 라우트를 감싸는 레이아웃 컴포넌트(TanStack Query로 세션을 읽는다)로, loader에 인증을 섞지 않는다(화면 이슈들이 loader를 자유롭게 쓰게).
- QueryClient 기본값: 401은 재시도하지 않는다(재시도해도 결과가 같다). 세션 쿼리는 로그인 · 로그아웃 뒤 무효화.
- fetch는 같은 출처(`credentials: "same-origin"`, 기본값). API 호출은 `src/api/`에 모으고, 401이면 `UnauthorizedError`를 던진다.

## 4. 토큰

`design/tokens.json`을 순수 함수 `tokensToCss`로 `:root` 변수로 바꾸고, 생성 스크립트가 `src/styles/tokens.css`에 쓴다. 테스트가 "지금 tokens.json으로 만든 결과 = 저장된 tokens.css"를 확인해 둘이 어긋나면 `pnpm verify`가 빨개진다(별도 docs:check 단계를 만들지 않는다).

- 색 `color.<이름>` → `--<이름>`(editor-react · content-render CSS가 이미 이 이름을 쓴다)
- 글꼴 `font.body/display/hand` → `--font-sans` · `--font-display` · `--font-hand`
- 크기 `size.*` 중 px 길이 → `--<이름>`(rem 변환). px 길이가 아닌 값(focus-ring 설명 등)은 건너뛴다
- `--brand`는 post.css가 쓰는 사이트 쪽 이름이라 `--brand-ink`의 별칭으로 둔다

## 5. 버린 것

- msw: 지금 테스트는 순수 함수뿐이라 네트워크 경계 mock이 필요 없다. 화면 이슈에서 통합 테스트가 생길 때 ADR-022의 재검토 조건으로 들인다.
- Tailwind(adr-006의 CSS 결정): editor-react가 이미 토큰 CSS 변수 + 일반 CSS로 쓰고 있다. 두 방식을 섞지 않고 web도 같은 방식으로 시작한다 — ADR-022에 기록.
