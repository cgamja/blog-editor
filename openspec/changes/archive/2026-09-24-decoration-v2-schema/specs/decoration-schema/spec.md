## MODIFIED Requirements

### Requirement: 꾸미기 속성은 최상위 블록의 attrs에만, 닫힌 집합으로 들어간다

최상위 블록의 `attrs`는 SHALL 선택 속성 `font` · `motion` · `stickers`를 받는다. `image` · `appScreenshot`은 추가로 `width`를 받는다. `paragraph` · `heading` · `image` · `appScreenshot`은 `align`도 받는다(ADR-020). 값의 집합:

- `font`: `pretendard` · `jua` · `gaegu` — 글자가 있는 블록(`paragraph` · `heading` · `blockquote` · `callout` · `bulletList` · `orderedList`)에만. 생략 = 사이트 기본(Pretendard)
- `motion`: `fade-in` · `fade-up` · `slide-left` · `slide-right` · `pop` — 모든 최상위 블록. 생략 = 움직임 없음
- `width`: 정수 25~100(%). 생략 = 100. 편집기의 「작게 · 보통 · 꽉 차게」는 이 범위 안의 값일 뿐 스키마는 모른다
- `align`: `left` · `center` · `right`. 생략 = 블록 종류의 기본(글은 왼쪽, 폭을 줄인 그림은 가운데)
- `stickers`: 배열, 원소 `{ id, x, y, size, rotate }`
  - `id`: 사이트 두들 9종(`star-coral` · `star-mint` · `heart` · `cloud` · `bottle` · `rattle` · `pacifier` · `foot-coral` · `foot-mint`)
  - `x` · `y`: 정수 −25~125(블록 폭 · 높이 기준 %). 가장자리에 걸치는 것을 허용한다
  - `size`: 정수 2~50(블록 폭 기준 %)
  - `rotate`: 정수 −180~180(도)

안쪽 노드(`listItem` · 인용 안 `paragraph` · `listItem`/`callout` 안의 중첩 `bulletList`/`orderedList` 등)와 `text`에는 꾸미기 속성 자리가 없다. 스티커 상한이 안쪽 노드로 우회되지 않게 하기 위해서다. 임의 CSS · 클래스 · px 좌표를 넣을 키는 존재하지 않는다.

#### Scenario: 꾸미기를 최대로 쓴 문서가 통과한다

- **WHEN** 다음 블록들을 쓴 문서를 파싱한다
  - `font: "jua"` · `align: "center"` 문단
  - `motion: "fade-up"` 제목
  - `width: 60` · `align: "right"` 이미지
  - 스티커가 붙은 블록들 — 합계 12개, 각 필드가 범위 끝값 −25 · 125 · 2 · 50 · −180 · 180을 포함
- **THEN** `success === true`

#### Scenario: 집합 · 범위 밖 값은 거부한다

- **WHEN** 다음 열 가지를 각각 넣는다
  - `font: "comic-sans"` · `motion: "spin"`
  - `width: 24` · `width: 101` · `width: 50.5`
  - 스티커 `id: "unicorn"` · `x: 126` · `size: 1` · `rotate: 181`
  - `align: "justify"`
- **THEN** 열 경우 모두 `success === false`

#### Scenario: 속성이 허용되지 않는 자리에서는 거부한다

- **WHEN** 다음 여섯 자리에 각각 넣는다
  - `codeBlock`에 `font`, `paragraph`에 `width`, `bulletList`에 `align`
  - `listItem`에 `stickers`, `text`에 `motion`, `callout` 안 `bulletList`에 `stickers`
- **THEN** 여섯 경우 모두 `success === false`

## ADDED Requirements

### Requirement: 글자 스타일 마크는 이름 붙은 값과 hex만 받는다

마크 `textStyle`의 `attrs`는 SHALL 선택 속성 하나 이상을 가진 strict 객체다(ADR-020).

- `font`: 블록 `font`와 같은 집합
- `weight`: `light` · `medium` · `heavy`. 글꼴마다 허용 목록이 있다 — Pretendard 셋 다, Gaegu `light`, Jua 없음. 기준은 같은 마크의 `font`이고, 없으면 Pretendard다
- `size`: `sm` · `lg` · `xl` · `2xl`
- `color`: `muted` · `brand` · `green` · `red` 또는 `#rrggbb`(소문자 16진 6자리)
- `highlight`: `apricot` · `mint` · `yellow` 또는 `#rrggbb`

#### Scenario: 이름 · hex 값과 글꼴에 맞는 두께가 통과한다

- **WHEN** `{ color: "brand", size: "lg" }` · `{ highlight: "#ffeecc" }` · `{ font: "gaegu", weight: "light" }` · `{ weight: "heavy" }`를 textStyle attrs로 쓴다
- **THEN** 넷 모두 `success === true`

#### Scenario: 빈 스타일 · 정의 밖 값 · 글꼴에 없는 두께는 거부한다

- **WHEN** `{}` · `{ color: "#FFF" }` · `{ color: "red; background:url(x)" }` · `{ size: "3xl" }` · `{ font: "jua", weight: "light" }` · `{ style: "color:red" }`를 각각 쓴다
- **THEN** 여섯 경우 모두 `success === false`
