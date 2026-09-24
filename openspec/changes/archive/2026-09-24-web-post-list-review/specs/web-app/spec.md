## ADDED Requirements

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
