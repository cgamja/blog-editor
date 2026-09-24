# render-decoration Specification

## Purpose

꾸미기(글씨체 · 움직임 · 폭 · 스티커)를 HTML로 낼 때의 닫힌 어휘. 값은 데이터(enum · 정수)이고 HTML에는 `data-*`와 CSS 변수로만 나간다 — 임의 CSS · 클래스 · px 좌표는 생기지 않는다(adr-008).

## Requirements

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

### Requirement: 스티커는 래퍼 안 img로, 위치는 CSS 변수로 나온다

렌더러는 SHALL 스티커마다 블록 요소 뒤(같은 래퍼 안)에 `<img class="post-sticker" src="{imageBaseUrl}/stickers/{id}.png" alt="" width="{w}" height="{h}" loading="lazy" decoding="async" style="--x:{x};--y:{y};--s:{size};--r:{rotate}">`를 순서대로 낸다. `width` · `height`는 스티커 원본 픽셀 크기(패키지 상수 — 사이트 `public/stickers/` 9종과 같다)라 레이아웃 이동이 없다. 좌표 의미(`x` · `y`는 스티커 중심의 블록 기준 %, `size`는 블록 폭 기준 %)는 `render-css`가 해석한다.

#### Scenario: 스티커 두 개가 순서대로 나온다

- **WHEN** 문단에 `stickers: [{ id: "star-coral", x: -25, y: 0, size: 5, rotate: -180 }, { id: "heart", x: 50, y: 30, size: 20, rotate: 0 }]`를 주고 `imageBaseUrl: "https://cdn.example.com"`으로 렌더한다
- **THEN** `<p>` 뒤에 `<img class="post-sticker" src="https://cdn.example.com/stickers/star-coral.png" alt="" width="151" height="160" loading="lazy" decoding="async" style="--x:-25;--y:0;--s:5;--r:-180">` 다음 `heart`(160×128, `--x:50;--y:30;--s:20;--r:0`)가 온다

#### Scenario: 스티커 9종 전부 크기 상수가 있다

- **WHEN** `STICKER_IDS`(`@blog-editor/content-schema`)의 각 id로 스티커 하나짜리 문단을 렌더한다
- **THEN** 아홉 출력 모두 `width="…" height="…"`가 양의 정수다

실패 의미론: 해당 없음 — 순수 함수.

### Requirement: 스티커 원본 파일은 크기 상수와 같다

`packages/content-render/assets/stickers/`는 SHALL `STICKER_IDS`마다 `{id}.png` 한 장을 두고, 그 PNG의 픽셀 크기는 `STICKER_SIZES[id]`와 같다. 공개 URL `{imageBaseUrl}/stickers/{id}.png`의 원본 폴더다.

#### Scenario: 아홉 장 모두 있고 크기가 상수와 같다

- **WHEN** `STICKER_IDS`의 각 id로 `assets/stickers/{id}.png`의 PNG 헤더(IHDR)를 읽는다
- **THEN** 아홉 장 모두 있고 너비 · 높이가 `STICKER_SIZES[id]`와 같다

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
