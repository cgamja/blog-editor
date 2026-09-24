## MODIFIED Requirements

### Requirement: 코드 토큰 파일은 디자인 토큰과 어긋나지 않는다

`@blog-editor/design-tokens`는 SHALL `src/tokens.css`를 `design/tokens.json`에서 `tokensToCss`로 만든 결과와 같게 두고, web과 editor-react(플레이그라운드)는 SHALL 이 한 파일을 불러온다 — 토큰 CSS 사본을 따로 두지 않는다(adr-023). 색은 `--<이름>`, 글꼴은 `--font-sans` · `--font-display` · `--font-hand`, 크기 토큰 중 px 길이는 rem 값의 `--<이름>`(선 두께 · 포커스 고리는 px), 간격 토큰 `space.<n>`은 rem 값의 `--space-<n>`이다. 잘못된 토큰은 생성을 멈춘다.

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
- **THEN** `@blog-editor/design-tokens`에 저장된 `src/tokens.css`와 글자 하나 다르지 않다
