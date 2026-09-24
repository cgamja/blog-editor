# ADR-025. 토큰 밖 CSS 값은 의존성 없는 검사 스크립트로 막는다

- 날짜: 2026-09-25
- 상태: 제안됨 (#116)

## 문제 (맥락)

`.claude/rules/platform.md` · `components.md`는 "색 · 간격은 토큰만"을 요구하지만 강제 수단이 없었다. `design.tokens` 선언(#117)은 원천이 어디인지만 알려 줄 뿐 값을 검사하지 않는다. #103(PR #109) 리뷰에서는 같은 쓰임새의 리터럴이 반만 토큰으로 바뀐 채 남은 것을 사람이 찾았다. 토큰 원천이 바뀌면 화면 일부만 조용히 어긋난다.

## 결정

**의존성 없는 검사기**를 두고 `pnpm verify`(pre-push · CI)에 넣는다.

- 규칙 — `packages/design-tokens/src/css-token-lint.ts`의 순수 함수 `findTokenViolations(css)`. 토큰의 주인이 규칙도 가진다(`@blog-editor/design-tokens/css-token-lint`로 내보낸다)
  - 주석 · 문자열을 공백으로 지운 뒤 `{` `}`와 괄호 밖 `;`로 선언을 자른다. 선택자 · 미디어 쿼리 · 주석 속 값은 선언이 아니고, `url(data:…;…)` 안의 `;`에서는 자르지 않는다
- 어느 파일을 볼지 — 루트 `scripts/check-css-tokens.ts`(`pnpm lint:css`)가 레포를 훑는다. 잎 패키지가 소비자 경로를 알지 않고, 새 CSS 파일은 등록 없이 검사된다
  - 뺀다: 산출물 · 도구 폴더(node_modules · dist · .claude · coverage 등), `tokens.css`(정본), content-render `post.css`와 `contract/` 사본(사이트 계약 — 사이트 토큰과 따로 간다)
- 막는 것
  - 색 리터럴(16진 · `rgb()`/`hsl()` 계열)은 어느 선언에서나 막는다
  - 순수 색 속성(`color` · `background-color` · `border*-color` · `outline-color` · `fill` · `stroke` · `caret-color` · `accent-color` · `text-decoration-color`)은 허용 목록 밖 식별자를 막는다. 허용 목록은 전역 키워드 · `transparent` · `currentColor` · `none` · `auto` · 시스템 색이다
  - 줄임 속성(`background` · `border` · `box-shadow` 등)과 범위 변수는 다른 낱말과 섞이므로 CSS Color 4 이름 있는 색 목록으로만 막는다
  - `px` · `rem` 길이는 간격(margin · padding · gap · inset) · 선 두께(border · outline) · 글자 크기(font-size · font) · 범위 변수(`--x`)에서 막는다
- 허용하는 것
  - `var(--x, <fallback>)`의 fallback(중첩 fallback 포함) — 토큰이 없을 때의 안전값(adr-023)
  - `0`, `em` · `%` · `vw` · `dvh`, `url()` 안, `!important`(값만 본다)
- 예외 — `/* token-lint-ignore: <이유> */`를 선언 하나에만 붙인다
  - 같은 줄 뒤에 붙으면 주석 바로 앞 선언 하나, 주석만 있는 윗줄이면 다음 줄의 첫 선언 하나
  - 표시는 주석 맨 앞, 콜론 필수, 이유에 글자 · 숫자가 하나 이상. 아니면 위반으로 남는다
- 대상 밖 — 반경 · 폭 · 높이 · `top/left` 같은 위치 값
  - 반경 토큰은 이미 있지만 버튼 · 입력 · 카드처럼 쓰임새로 갈라져 있다. 같은 `0.5rem`이 어느 쓰임새인지를 값만 보고 정할 수 없다
  - 위치 · 크기 값은 대부분 계산식이거나 화면 좌표라 척도와 뜻이 다르다

## 버린 대안

LIBRARY 게이트 2단계 표(2026-09-25 npm 기준)로 비교했다.

- **stylelint 17.15.0 + stylelint-declaration-strict-value 1.12.1**
  - 둘 다 MIT이고 최근 릴리스(2026-09 · 2026-08)가 있으며 타입이 있다. 규칙 표현력은 더 크다
  - 하지만 stylelint는 직접 의존성만 35개다(postcss · css-tree · globby · cosmiconfig …). 필요한 기능은 선언 값 검사 하나뿐이다(LIBRARY 1단계 3번 "일부만 필요하고 엣지 케이스가 적으면 직접 구현")
  - 설정 파일 · 무시 문법도 하나씩 늘어난다
- **stylelint 단독(`color-no-hex` · `declaration-property-unit-disallowed-list`)**: 16진 색과 단위는 막는다. 하지만 `var()` fallback을 빼는 일과, 예외 주석에 이유를 강제하는 일을 못 한다
- **ESLint 규칙**: ESLint는 CSS 파일을 보지 않는다(프로젝트 설정 밖)

## 감수한 트레이드오프

- 검사기는 CSS 문법을 전부 알지 못한다. 중첩 CSS와 `@supports` 안의 복잡한 값은 다루지 않는다. 지금 CSS(손으로 쓴 10개 파일)에서는 grep 교차 확인과 결과가 같았다
- 규칙 표현력이 낮다. 대신 규칙이 코드 한 파일에 다 보이고, 테스트 20개가 명세다
- `scripts/*.ts`를 Node 타입 제거로 바로 돌리므로 Node 22.18 이상이 필요하다(`engines`, CI `22.x`)

## 재검토 조건

- CSS 문법 오판(거짓 양성 · 음성)이 두 번 나오면 → stylelint로 옮긴다(위 표가 출발점)
- 디자인이 반경을 쓰임새가 아니라 척도(값 하나 = 이름 하나)로 정하거나, 크기 토큰이 생기면 → 대상 속성을 넓힌다
- CSS Modules · Tailwind 등 스타일 방식을 바꾸면 → 다시 본다
