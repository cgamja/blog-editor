# web-app Specification

## Purpose

백오피스 화면 앱(`apps/editor/web`)의 뼈대 — 세션 판정 · 로그인 리다이렉트와 돌아갈 경로 · 코드 토큰 동기화 · 개발 서버 규칙. 각 화면은 이 위에 라우트로 붙는다(adr-006 · adr-022).

## Requirements

### Requirement: 세션 확인 응답의 상태 코드로 로그인 여부를 판정한다

web은 SHALL 세션 확인 요청의 상태 코드를 `sessionStateOf(status)`로 판정한다. 2xx는 로그인됨, 401은 로그인 필요, 그 밖의 코드는 오류다.

#### Scenario: 2xx는 로그인됨

- **WHEN** 상태 코드 200 · 204를 판정한다
- **THEN** 로그인됨이다

#### Scenario: 401은 로그인 필요

- **WHEN** 상태 코드 401을 판정한다
- **THEN** 로그인 필요다

#### Scenario: 그 밖의 코드는 오류

- **WHEN** 상태 코드 403 · 404 · 500을 판정한다
- **THEN** 오류다

### Requirement: 로그인 뒤 돌아갈 경로는 이 앱 안의 경로만 받는다

web은 SHALL `safeNextPath(raw)`로 로그인 뒤 이동할 경로를 고른다. `/`로 시작하는 이 앱 안의 경로만 그대로 쓰고, 다른 출처로 가는 주소 · 로그인 화면 자신 · 비어 있는 값은 `/`로 바꾼다.

#### Scenario: 앱 안의 경로는 그대로

- **WHEN** `/posts/hello/edit?tab=info`를 고른다
- **THEN** 같은 경로다

#### Scenario: 다른 출처로 가는 주소는 첫 화면으로

- **WHEN** `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`을 고른다
- **THEN** 모두 `/`다

#### Scenario: 로그인 화면 자신 · 빈 값은 첫 화면으로

- **WHEN** `/login`, `/login?next=/x`, 빈 문자열, 값 없음을 고른다
- **THEN** 모두 `/`다

#### Scenario: 제어 문자가 든 경로는 첫 화면으로

- **WHEN** 줄바꿈이 든 `/a\nb`를 고른다
- **THEN** `/`다

### Requirement: 로그인이 필요한 화면은 지금 경로를 기억해 로그인 화면으로 보낸다

web은 SHALL 로그인 필요 판정을 받으면 `loginPathFor(current)`가 만든 `/login?next=<인코딩한 지금 경로>`로 보낸다. 지금 경로가 `/`면 `next`를 붙이지 않는다.

#### Scenario: 편집 화면에서 로그인이 풀리면

- **WHEN** `/posts/hello/edit`에서 로그인 필요 판정을 받는다
- **THEN** `/login?next=%2Fposts%2Fhello%2Fedit`로 보낸다

#### Scenario: 첫 화면에서는 next 없이

- **WHEN** `/`에서 로그인 필요 판정을 받는다
- **THEN** `/login`으로 보낸다

### Requirement: 코드 토큰 파일은 디자인 토큰과 어긋나지 않는다

web은 SHALL `src/styles/tokens.css`를 `design/tokens.json`에서 `tokensToCss`로 만든 결과와 같게 둔다. 색은 `--<이름>`, 글꼴은 `--font-sans` · `--font-display` · `--font-hand`, 크기 토큰 중 px 길이는 rem 값의 `--<이름>`이다.

#### Scenario: 색 토큰은 같은 이름의 CSS 변수

- **WHEN** 색 토큰 `brand-ink: #b0552f`를 바꾼다
- **THEN** `--brand-ink: #b0552f;`가 있다

#### Scenario: px 크기는 rem으로, 길이가 아닌 값은 건너뛴다

- **WHEN** 크기 토큰 `control-height: 44px`와 `focus-ring: 2px solid …`를 바꾼다
- **THEN** `--control-height: 2.75rem;`이 있고 focus-ring 변수는 없다

#### Scenario: 저장된 토큰 파일이 지금 디자인 토큰과 같다

- **WHEN** 지금 `design/tokens.json`으로 CSS를 만든다
- **THEN** 저장된 `src/styles/tokens.css`와 글자 하나 다르지 않다

### Requirement: 개발 서버는 정해진 포트에서만, 로컬 API와 같은 출처로 뜬다

web의 Vite 개발 서버는 SHALL `PORT` 환경 변수가 없거나 정수가 아니면 시작하지 않고, 포트가 잡혀 있으면 옆 포트로 옮기지 않는다(`strictPort`). `/api` · `/images` · `/public` 요청은 `127.0.0.1:8787`(또는 `API_PORT`로 지정한 포트)로 넘긴다.

#### Scenario: 로그인하지 않고 첫 화면을 열면 로그인 화면으로 간다(실브라우저)

- **WHEN** 로컬 API와 web을 띄우고 로그인하지 않은 채 `/`를 연다
- **THEN** `/login`이 뜨고, 로그인하면 `/`로 돌아온다
