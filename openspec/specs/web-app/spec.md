# web-app Specification

## Purpose

백오피스 화면 앱(`apps/editor/web`)의 뼈대 — 세션 판정 · 로그인 리다이렉트와 돌아갈 경로 · 401 처리 · 요청 도우미 · 코드 토큰 동기화. 각 화면은 이 위에 라우트로 붙는다(adr-006 · adr-022). 개발 서버 규칙(PORT · strictPort · 프록시)은 행동이 아닌 제약이라 change design.md 3-2에 둔다.

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

web은 SHALL `safeNextPath(raw)`로 로그인 뒤 이동할 경로를 고른다. `/`로 시작하는 이 앱 안의 경로만 그대로 쓰고, 다른 출처로 가는 주소 · 로그인 화면 자신(대소문자 무관) · 제어 문자가 든 값 · 비어 있는 값은 `/`로 바꾼다.

#### Scenario: 앱 안의 경로는 그대로

- **WHEN** `/posts/hello/edit?tab=info`를 고른다
- **THEN** 같은 경로다

#### Scenario: 다른 출처로 가는 주소는 첫 화면으로

- **WHEN** `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`을 고른다
- **THEN** 모두 `/`다

#### Scenario: 공백 · 백슬래시로 감싼 주소와 쿼리에서 디코딩한 주소도 첫 화면으로

- **WHEN** 탭으로 시작하는 `//evil`, `/` 뒤에 탭이 든 `/evil`, `\\evil`, `next=%2F%2Fevil`에서 꺼낸 값을 고른다
- **THEN** 모두 `/`다

#### Scenario: 로그인 화면 자신 · 빈 값은 첫 화면으로

- **WHEN** `/login`, `/login?next=/x`, 빈 문자열, 값 없음을 고른다
- **THEN** 모두 `/`다

#### Scenario: 대소문자만 다른 로그인 화면도 첫 화면으로

- **WHEN** `/LOGIN`, `/Login?next=/x`, `/login/`을 고른다
- **THEN** 모두 `/`다

#### Scenario: 제어 문자가 든 경로는 첫 화면으로

- **WHEN** 줄바꿈이 든 `/a\nb`를 고른다
- **THEN** `/`다

### Requirement: 가드는 로그인이 필요하면 지금 경로를 기억해 로그인 화면으로 보내고, 로그인하면 그 경로로 돌려보낸다

web은 SHALL 로그인 필요 판정을 받으면 `loginPathFor(current)`가 만든 `/login?next=<인코딩한 지금 경로>`로 보낸다(지금 경로가 `/`면 `next` 없이). 로그인에 성공하면 `markSignedIn`으로 세션 캐시를 바로 로그인됨으로 바꾼 뒤 `next`로 이동해, 가드가 남은 로그인 필요 값을 읽고 되돌려 보내지 않는다.

#### Scenario: 편집 화면에서 로그인이 풀리면

- **WHEN** `/posts/hello/edit`에서 로그인 필요 판정을 받는다
- **THEN** `/login?next=%2Fposts%2Fhello%2Fedit`로 보낸다

#### Scenario: 첫 화면에서는 next 없이

- **WHEN** `/`에서 로그인 필요 판정을 받는다
- **THEN** `/login`으로 보낸다

#### Scenario: 로그인 성공 뒤 가드의 첫 읽기는 로그인됨

- **WHEN** 가드가 로그인 화면으로 보내 세션 캐시가 로그인 필요인 채로 로그인에 성공한다
- **THEN** 가드와 같은 옵션의 세션 쿼리가 캐시에서 바로 로그인됨을 읽는다

#### Scenario: 로그인하지 않고 첫 화면을 열고 같은 페이지에서 로그인하면 첫 화면으로 돌아온다(실브라우저)

- **WHEN** 로컬 API와 web을 띄우고 빈 캐시로 `/`를 열어 로그인 화면으로 간 뒤 같은 페이지에서 로그인한다
- **THEN** `/`의 글 목록 자리가 뜨고 로그인 화면으로 되돌아가지 않는다

### Requirement: 어느 요청이든 401이면 세션을 로그인 필요로 바꾼다

web의 QueryClient는 SHALL 쿼리나 mutation이 `UnauthorizedError`로 실패하면 세션 캐시를 로그인 필요로 바꾸고, 401은 재시도하지 않는다. 401이 아닌 오류는 세션을 건드리지 않고 3번까지 재시도한다.

#### Scenario: 쿼리 401은 세션을 로그인 필요로

- **WHEN** 쿼리가 `UnauthorizedError`로 실패한다
- **THEN** 세션이 로그인 필요다

#### Scenario: mutation 401도 세션을 로그인 필요로

- **WHEN** 저장 같은 mutation이 `UnauthorizedError`로 실패한다
- **THEN** 세션이 로그인 필요다

#### Scenario: 401이 아닌 오류는 세션을 건드리지 않는다

- **WHEN** 쿼리가 409 `ApiError`로 실패한다
- **THEN** 세션이 로그인됨 그대로다

#### Scenario: 401은 재시도하지 않는다

- **WHEN** 재시도 여부를 묻는다
- **THEN** 401은 다시 묻지 않고, 다른 오류는 3번까지 다시 묻는다

### Requirement: API 요청 도우미는 401과 그 밖의 실패를 오류로 나눈다

web은 SHALL 화면의 API 요청을 `apiRequest(path, init)`로 보낸다. 401은 `UnauthorizedError`, 409는 `ConflictError`(둘 다 `ApiError`), 그 밖의 실패는 상태 코드와 본문 `message`(없으면 null)를 가진 `ApiError`로 던지고, 2xx는 응답을 그대로 돌려준다. 화면은 409를 `instanceof ConflictError`로 가른다(.claude/rules/state.md).

#### Scenario: 401은 UnauthorizedError

- **WHEN** 401을 받는다
- **THEN** `UnauthorizedError`다

#### Scenario: 문장이 든 실패는 그 문장을 가진 ApiError

- **WHEN** `message`가 든 JSON 409를 받는다
- **THEN** 상태 409와 그 문장을 가진 `ApiError`다

#### Scenario: JSON이 아닌 실패는 문장 없는 ApiError

- **WHEN** 본문이 JSON이 아닌 502를 받는다
- **THEN** 상태 502, 문장 null인 `ApiError`다

#### Scenario: 2xx는 응답 그대로

- **WHEN** 204를 받는다
- **THEN** 그 응답을 돌려준다

#### Scenario: 409는 ConflictError

- **WHEN** 409를 받는다
- **THEN** `ConflictError`다

### Requirement: 코드 토큰 파일은 디자인 토큰과 어긋나지 않는다

web은 SHALL `src/styles/tokens.css`를 `design/tokens.json`에서 `tokensToCss`로 만든 결과와 같게 둔다. 색은 `--<이름>`, 글꼴은 `--font-sans` · `--font-display` · `--font-hand`, 크기 토큰 중 px 길이는 rem 값의 `--<이름>`(선 두께 · 포커스 고리는 px), 간격 토큰 `space.<n>`은 rem 값의 `--space-<n>`이다. 잘못된 토큰은 생성을 멈춘다.

#### Scenario: 색 토큰은 같은 이름의 CSS 변수

- **WHEN** 색 토큰 `brand-ink: #b0552f`를 바꾼다
- **THEN** `--brand-ink: #b0552f;`가 있다

#### Scenario: px 크기는 rem으로, 길이가 아닌 값은 건너뛴다

- **WHEN** 크기 토큰 `control-height: 44px`와 `focus-ring: 2px solid …`를 바꾼다
- **THEN** `--control-height: 2.75rem;`이 있고 focus-ring 변수는 없다

#### Scenario: 간격 토큰은 --space-<n>

- **WHEN** 간격 토큰 `8: 8px`을 바꾼다
- **THEN** `--space-8: 0.5rem;`이 있다

#### Scenario: 선 두께 · 포커스 고리는 px 그대로

- **WHEN** 크기 토큰 `border-width: 1px` · `focus-ring-width: 2px` · `focus-ring-offset: 2px`을 바꾼다
- **THEN** 셋 다 rem이 아니라 px 값의 변수다(글자 크기를 키워도 굵어지지 않는다)

#### Scenario: 잘못된 토큰이면 생성이 멈춘다

- **WHEN** 이름에 `[a-z0-9-]` 밖의 글자가 있거나, 같은 CSS 변수 이름이 두 번 나오거나, 간격이 px가 아니거나, 색이 hex · rgb가 아니다
- **THEN** 조용히 빼지 않고 오류를 던진다

#### Scenario: 저장된 토큰 파일이 지금 디자인 토큰과 같다

- **WHEN** 지금 `design/tokens.json`으로 CSS를 만든다
- **THEN** 저장된 `src/styles/tokens.css`와 글자 하나 다르지 않다

### Requirement: 글자 크기 · 그림자도 디자인 토큰에서 만든다

web의 토큰 생성기는 SHALL `font` 그룹의 px 값을 `--font-size-<이름>`(rem)으로, `shadow` 그룹을 `--shadow-<이름>`으로 만든다. 그림자 색은 색 토큰 이름과 불투명도로 적고 `color-mix`로 그 색 토큰을 쓴다. 모양이 다르거나 없는 색 이름이면 생성이 멈춘다.

#### Scenario: px 글자 크기는 --font-size-<이름>

- **WHEN** `font`에 `ui: 15px`, `body: 글꼴 이름`을 준다
- **THEN** `--font-size-ui: 0.9375rem`이 있고 글꼴 이름은 크기가 되지 않는다

#### Scenario: 그림자는 색 토큰을 섞는다

- **WHEN** `shadow.card`를 `0 2px 4px ink 12%, 0 1px 2px ink 8%`로 준다
- **THEN** `--shadow-card: 0 2px 4px color-mix(in srgb, var(--ink) 12%, transparent), 0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent)`다

#### Scenario: 잘못된 그림자면 생성이 멈춘다

- **WHEN** 없는 색 이름이나 불투명도가 빠진 그림자를 준다
- **THEN** 생성이 멈춘다
