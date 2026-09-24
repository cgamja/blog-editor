# render-safety Specification

## Purpose

렌더 결과는 사이트가 그대로 꽂는 HTML이다. 스크립트가 실릴 길이 렌더러에 없다는 것을 회귀 테스트로 고정한다 — 사이트의 sanitize(#8)는 두 번째 방어선이지 첫 번째가 아니다(plan 05 계약 층).

## Requirements

### Requirement: 렌더 결과에 스크립트 · 이벤트 핸들러 · javascript: 스킴이 없다 (보호 대상 — 고쳐서 통과시키지 않는다)

`renderHtml`의 출력은 SHALL 어떤 입력에서도 `<script` 문자열, 이름이 `on`으로 시작하는 속성, `javascript:` 스킴으로 시작하는 `href` · `src` 값을 담지 않는다. 판정은 태그 안의 속성 이름과 속성값에 대한 것이다 — 이스케이프되어 본문 글자로 남은 `onload=`나 `javascript:` 텍스트는 태그도 속성도 아니므로 위반이 아니다. 문서 문자열은 전부 이스케이프되고, 속성은 렌더러가 닫힌 목록에서만 만든다(`class` · `data-font` · `data-motion` · `data-align` · `data-weight` · `data-size` · `data-color` · `data-highlight` · `data-tone` · `data-language` · `style` · `href` · `src` · `alt` · `width` · `height` · `loading` · `decoding`). `style` 값의 선언은 스티커 · 폭 정수 변수(`--x` · `--y` · `--s` · `--r` · `--w`: `-?정수`)와 글자 스타일 색 변수(`--ts-color` · `--ts-highlight`: `#` + 소문자 16진 6자리)뿐이다 — 정수 변수는 값이 정수(number)가 아니면 렌더하지 않고 `RangeError`를 던지고, 색은 렌더러가 문자열인지와 hex 모양을 다시 보고 아니면 내지 않는다(이스케이프는 `;`로 선언을 잇는 것을 막지 못한다). `href`의 스킴은 스키마가 막는다(렌더러는 검증된 doc를 받는다, adr-009) — 렌더러의 책임은 `href`를 포함한 모든 값의 이스케이프이고, enum · 정수 값(font · motion · tone · 좌표)도 예외 없이 이스케이프한다. heading level과 스티커 id는 닫힌 표에서만 꺼내고 표에 없으면 렌더하지 않고 오류를 던진다(태그 이름은 이스케이프로 막을 수 없다). 이 테스트를 통과시키기 위해 단언을 완화하지 않는다.

#### Scenario: 대표 픽스처와 적대적 문서 모두 금지 패턴이 없다

- **WHEN** `fixtures` 3개와, 텍스트 · `alt` · `caption` · `codeBlock` 본문에 `<script>alert(1)</script>` · `" onload="x` · `javascript:alert(1)`를 넣고 링크 `href`에 `/a"onmouseover="x`(스키마가 허용하는 내부 경로)를 넣은 문서를 각각 렌더한다
- **THEN** 어느 출력에도 `<script`가 없고, 태그 안 속성 이름 중 `on`으로 시작하는 것이 없고, `href` · `src` 값 중 `javascript:`로 시작하는 것이 없다. 적대적 문자열은 이스케이프된 글자로만 남는다(`<p>&lt;script&gt;…</p>` · `alt="&quot; onload=&quot;x"` · `<p>javascript:alert(1)</p>` · `<a href="/a&quot;onmouseover=&quot;x">`)

#### Scenario: 표에 없는 heading level · 스티커 id는 렌더하지 않고 오류를 던진다

- **WHEN** 검증을 건너뛴 문서로 `attrs.level`이 `4`인 heading과 `"2 onload=x"`인 heading, `id`가 `"moon"`인 스티커를 각각 렌더한다
- **THEN** 세 경우 모두 `RangeError`를 던지고 HTML을 돌려주지 않는다

#### Scenario: 속성은 닫힌 목록 밖으로 나가지 않는다

- **WHEN** `fixtures.decorationMax`를 렌더하고 출력의 모든 `속성명=` 꼴을 모은다
- **THEN** 집합이 위 목록의 부분집합이다

#### Scenario: 검증을 건너뛴 글자 스타일 값도 style에 허용 꼴만 남긴다

- **WHEN** 검증을 건너뛴 문서의 textStyle에 두 종류 값을 넣고, fixtures 3개와 함께 렌더한다
  - `font` · `weight` · `size`: 적대적 문자열
  - `color` · `highlight`: `#aabbcc\n` · `#AABBCC` · `#000;x:url(a)` · 숫자 · `toString` 객체(검사 때와 출력 때 다른 글자를 내는 것 포함)
- **THEN** 모든 `style` 값의 선언이 `--[xysrw]:-?정수` 또는 `--ts-(color|highlight):#[0-9a-f]{6}` 꼴이다. `<script`와 `on*` 속성은 없다

#### Scenario: 정수가 아닌 폭 · 스티커 좌표는 style에 싣지 않고 오류를 던진다

- **WHEN** 검증을 건너뛴 문서의 이미지 `width`와 스티커 `x` · `y` · `size` · `rotate`에 각각 `"1;x:url(a)"` · 숫자 문자열 `"60"` · `toString` 객체 · `1.5` · `NaN`을 넣어 렌더한다
- **THEN** 모든 경우 `RangeError`를 던지고 HTML을 돌려주지 않는다

실패 의미론: 해당 없음 — 순수 함수.
