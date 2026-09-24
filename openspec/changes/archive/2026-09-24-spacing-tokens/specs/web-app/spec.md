## MODIFIED Requirements

### Requirement: 코드 토큰 파일은 디자인 토큰과 어긋나지 않는다

web은 SHALL `src/styles/tokens.css`를 `design/tokens.json`에서 `tokensToCss`로 만든 결과와 같게 둔다. 색은 `--<이름>`, 글꼴은 `--font-sans` · `--font-display` · `--font-hand`, 크기 토큰 중 px 길이는 rem 값의 `--<이름>`, 간격 토큰 `space.<n>`은 rem 값의 `--space-<n>`이다.

#### Scenario: 색 토큰은 같은 이름의 CSS 변수

- **WHEN** 색 토큰 `brand-ink: #b0552f`를 바꾼다
- **THEN** `--brand-ink: #b0552f;`가 있다

#### Scenario: px 크기는 rem으로, 길이가 아닌 값은 건너뛴다

- **WHEN** 크기 토큰 `control-height: 44px`와 `focus-ring: 2px solid …`를 바꾼다
- **THEN** `--control-height: 2.75rem;`이 있고 focus-ring 변수는 없다

#### Scenario: 간격 토큰은 --space-<n>

- **WHEN** 간격 토큰 `8: 8px`을 바꾼다
- **THEN** `--space-8: 0.5rem;`이 있다

#### Scenario: 저장된 토큰 파일이 지금 디자인 토큰과 같다

- **WHEN** 지금 `design/tokens.json`으로 CSS를 만든다
- **THEN** 저장된 `src/styles/tokens.css`와 글자 하나 다르지 않다
