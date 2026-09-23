# Spec Delta — render-css

## Purpose

본문용 CSS 한 파일. 렌더된 HTML의 닫힌 어휘(클래스 · `data-*` · CSS 변수)에 모양을 입힌다. 미리보기와 사이트가 같은 파일을 쓰고, 새 스티커 · 움직임을 더해도 사이트는 배포할 것이 없다(adr-008).

## ADDED Requirements

### Requirement: 본문용 CSS는 한 파일이고 사이트 토큰을 이어받는다

패키지는 SHALL `packages/content-render/src/post.css` 한 파일을 `@blog-editor/content-render/post.css`로 export한다. 모든 규칙은 `.post-body` 아래에만 걸리고, 색 · 글꼴은 사이트 `globals.css`의 토큰 이름(`--ink` · `--ink-soft` · `--brand` · `--brand-ink` · `--brand-soft` · `--surface-2` · `--line` · `--accent-soft` · `--accent-ink` · `--font-sans` · `--font-display` · `--font-hand`)을 `var()`로 참조만 하며 `:root`에 토큰을 정의하지 않는다(수동 복사, plan 09). 기본 본문 모양(제목 · 링크 · 리스트 · 인용 · 코드 · 이미지 프레임 · 구분선)은 사이트 `.prose`와 같은 값으로 옮긴다. 예외: 코드 블록 바탕 · 글자색은 사이트 `.prose pre`처럼 리터럴이다(사이트에도 그 의미의 토큰이 없다 — `--paper-ink`는 값만 같은 다른 뜻).

#### Scenario: 토큰을 정의하지 않고 참조만 한다

- **WHEN** `post.css`를 읽는다
- **THEN** `:root`를 선택하는 규칙이 없고, 위 토큰 이름이 각각 `var(--…)`로 한 번 이상 쓰인다

### Requirement: 꾸미기 어휘마다 규칙이 있다

CSS는 SHALL 스키마 enum의 모든 값에 규칙을 둔다 — `[data-font="pretendard"|"jua"|"gaegu"]`는 각각 `--font-sans` · `--font-display` · `--font-hand`, `[data-tone="note"|"tip"|"warning"]`는 각각 `--surface-2` · `--accent-soft` · `--brand-soft` 바탕, `[data-motion=…]` 5종은 각각 keyframes. `.post-block`은 `width: calc(var(--w, 100) * 1%)`로 폭을 받고 가운데 정렬, `position: relative`로 스티커의 기준이 된다. `.post-sticker`는 `left/top: calc(var(--x|--y) * 1%)` · `width: calc(var(--s) * 1%)` · `height: auto` · `transform: translate(-50%, -50%) rotate(calc(var(--r) * 1deg))` · `pointer-events: none`이고, 좁은 화면(`max-width: 48rem`)에서는 `left/top`을 `clamp(0%, …, 100%)`로 본문 안에 당겨 넣는다.

#### Scenario: 스키마 enum 값마다 선택자가 있다

- **WHEN** `FONTS` · `MOTIONS` · `CALLOUT_TONES`(`@blog-editor/content-schema`)의 각 값으로 `[data-font="…"]` · `[data-motion="…"]` · `[data-tone="…"]` 문자열을 만든다
- **THEN** 열한 문자열 전부 `post.css`에 들어 있다

### Requirement: 움직임은 JS 없이, 지원 브라우저에서만, 줄이기 설정을 따라 동작한다

움직임 규칙은 SHALL `@media (prefers-reduced-motion: no-preference)` **와** `@supports (animation-timeline: view())` 안에만 있고 `transform` · `opacity`만 바꾼다. 그 밖(미지원 브라우저 · 줄이기 설정)에서는 규칙이 적용되지 않아 내용이 그냥 보인다 — 초기 상태(투명 · 이동)를 조건 밖에 두지 않는다.

#### Scenario: 움직임 규칙이 두 조건 밖으로 새지 않는다

- **WHEN** `post.css`에서 `animation-timeline` · `@keyframes` · `data-motion`이 나오는 위치를 찾는다
- **THEN** 전부 `@media (prefers-reduced-motion: no-preference)`와 `@supports (animation-timeline: view())` 블록 안이고, 그 밖에는 `opacity: 0`이나 `transform:`이 `data-motion` 선택자에 걸리지 않는다

#### Scenario: 미지원 브라우저에서 내용이 그냥 보인다 (수동)

- **WHEN** `decorationMax` 렌더 결과 + `post.css`를 정적 HTML로 열고, 크롬에서 `animation-timeline` 지원을 끈 상태(또는 줄이기 설정)와 켠 상태를 본다
- **THEN** 끈 상태에서 모든 블록이 즉시 보이고, 켠 상태에서 스크롤 진입 시 움직인다 — 결과를 PR "확인 방법"에 적는다

실패 의미론: 해당 없음 — 정적 파일.
