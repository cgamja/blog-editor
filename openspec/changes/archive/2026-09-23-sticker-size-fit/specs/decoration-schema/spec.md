## MODIFIED Requirements

### Requirement: 꾸미기 속성은 최상위 블록의 attrs에만, 닫힌 집합으로 들어간다

최상위 블록의 `attrs`는 SHALL 선택 속성 `font` · `motion` · `stickers`를 받고, `image` · `appScreenshot`은 추가로 `width`를 받는다. 값의 집합:

- `font`: `pretendard` · `jua` · `gaegu` — 글자가 있는 블록(`paragraph` · `heading` · `blockquote` · `callout` · `bulletList` · `orderedList`)에만. 생략 = 사이트 기본(Pretendard)
- `motion`: `fade-in` · `fade-up` · `slide-left` · `slide-right` · `pop` — 모든 최상위 블록. 생략 = 움직임 없음
- `width`: 정수 25~100(%). 생략 = 100. 편집기의 「작게 · 보통 · 꽉 차게」는 이 범위 안의 값일 뿐 스키마는 모른다
- `stickers`: 배열, 원소 `{ id, x, y, size, rotate }` — `id`는 사이트 두들 9종(`star-coral` · `star-mint` · `heart` · `cloud` · `bottle` · `rattle` · `pacifier` · `foot-coral` · `foot-mint`), `x` · `y`는 정수 −25~125(블록 폭 · 높이 기준 %, 가장자리에 걸치는 것을 허용), `size`는 정수 5~25(블록 폭 기준 %). 상한 25는 좁은 화면에서도 스티커가 글을 가리지 않는 크기다(2026-09-23, 50에서 낮춤), `rotate`는 정수 −180~180(도)

안쪽 노드(`listItem` · 인용 안 `paragraph` · `listItem`/`callout` 안의 중첩 `bulletList`/`orderedList` 등)와 `text`에는 꾸미기 속성 자리가 없다 — 스티커 상한이 안쪽 노드로 우회되지 않게. 임의 CSS · 클래스 · px 좌표를 넣을 키는 존재하지 않는다.

#### Scenario: 꾸미기를 최대로 쓴 문서가 통과한다

- **WHEN** `font: "jua"` 문단, `motion: "fade-up"` 제목, `width: 60` 이미지, 스티커가 붙은 블록들(합계 12개, 각 필드가 범위 끝값 −25 · 125 · 5 · 25 · −180 · 180 포함)을 쓴 문서를 파싱한다
- **THEN** `success === true`

#### Scenario: 집합 · 범위 밖 값은 거부한다

- **WHEN** `font: "comic-sans"` · `motion: "spin"` · `width: 24` · `width: 101` · `width: 50.5` · 스티커 `id: "unicorn"` · `x: 126` · `size: 4` · `size: 26` · `rotate: 181`을 각각 넣는다
- **THEN** 열 경우 모두 `success === false`

#### Scenario: 속성이 허용되지 않는 자리에서는 거부한다

- **WHEN** `codeBlock`에 `font`, `paragraph`에 `width`, `listItem`에 `stickers`, `text`에 `motion`, `callout` 안 `bulletList`에 `stickers`를 각각 넣는다
- **THEN** 다섯 경우 모두 `success === false`
