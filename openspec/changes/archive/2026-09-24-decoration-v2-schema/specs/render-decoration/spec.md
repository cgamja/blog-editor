## MODIFIED Requirements

### Requirement: 꾸미기가 있는 블록만 래퍼로 감싼다

렌더러는 SHALL 최상위 블록의 `attrs`에 `font` · `motion` · `align` · `width` · `stickers` 중 하나라도 있을 때만 그 블록 요소를 래퍼로 감싼다. 래퍼는 `<div class="post-block" data-font="…" data-motion="…" data-align="…" style="--w:…">`이다.

- 속성은 있는 것만, 이 순서로 낸다: `class` → `data-font` → `data-motion` → `data-align` → `style`
- 꾸미기가 없는 블록은 래퍼 없이 요소만 낸다
- `style`에는 `--w:<정수>`(단위 없음) 외에 아무것도 오지 않는다

#### Scenario: 글씨체 · 움직임 · 폭이 래퍼 속성으로 나온다

- **WHEN** `attrs: { font: "jua", motion: "fade-up" }`인 제목과 `attrs: { width: 60, align: "right" }`인 이미지를 렌더한다
- **THEN** 두 출력은 다음과 같다
  - 제목: `<div class="post-block" data-font="jua" data-motion="fade-up"><h2>…</h2></div>`
  - 이미지: `<div class="post-block" data-align="right" style="--w:60"><figure class="post-image">…</figure></div>`

#### Scenario: 꾸미기 없는 블록은 래퍼가 없다

- **WHEN** `attrs` 없는 문단과 `attrs: { level: 2 }`뿐인 제목을 렌더한다
- **THEN** 출력에 `post-block`이 없다

## ADDED Requirements

### Requirement: 글자 스타일 · 취소선 · 밑줄은 태그와 data 속성으로 나온다

렌더러는 SHALL 마크를 다음처럼 낸다(ADR-020).

- `strike` → `<s>`, `underline` → `<u>`
- `textStyle` → `<span class="post-ts" data-font data-weight data-size data-color data-highlight>`
  - 속성은 있는 것만, 이 순서로 낸다
- 겹칠 때 바깥부터 순서: `a` > `span.post-ts` > `u` > `s` > `strong` > `em` > `code`

hex 색은 `data-color="custom"`(배경은 `data-highlight="custom"`)과 `style="--ts-color:#rrggbb;--ts-highlight:#rrggbb"`로 낸다. 렌더러는 스키마를 건너뛴 문서가 와도 값이 `^#[0-9a-f]{6}$`인지 다시 보고, 아니면 그 색 속성을 내지 않는다.

#### Scenario: 프리셋 · hex · 두께 · 크기가 한 span으로 나온다

- **WHEN** 텍스트 "가"에 textStyle `{ font: "pretendard", weight: "heavy", size: "lg", color: "brand", highlight: "#fff1cc" }`와 `underline`을 준 문단을 렌더한다
- **THEN** `<p><span class="post-ts" data-font="pretendard" data-weight="heavy" data-size="lg" data-color="brand" data-highlight="custom" style="--ts-highlight:#fff1cc"><u>가</u></span></p>`가 나온다

#### Scenario: 검증을 건너뛴 색 값은 CSS로 새지 않는다

- **WHEN** 스키마를 거치지 않은 doc의 textStyle `color`에 `#000;background:url(x)`를 넣어 렌더한다
- **THEN** 출력에 `url(` · `--ts-color` · `data-color`가 없다
