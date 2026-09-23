## ADDED Requirements

### Requirement: 이미지는 원본 픽셀 크기를 선택으로 가진다

`image` · `appScreenshot`의 `attrs`는 SHALL 선택 속성 `naturalWidth` · `naturalHeight`(정수 1~1600, 원본 이미지의 픽셀 크기)를 받는다. 둘은 함께 있거나 함께 없어야 한다 — 한쪽만 있으면 거부한다. 꾸미기 `width`(블록 폭 %)와는 다른 값이고 같이 쓸 수 있다. 크기 없는 옛 문서도 그대로 유효하다(schemaVersion 그대로).

#### Scenario: 크기가 있는 이미지와 없는 이미지가 모두 통과한다

- **WHEN** `naturalWidth: 1200, naturalHeight: 800, width: 60`인 `image`와 크기 없는 `appScreenshot`이 든 문서를 파싱한다
- **THEN** `success === true`

#### Scenario: 한쪽만 있거나 범위 밖이면 거부한다

- **WHEN** `naturalWidth: 1200`만 있는 `image`, `naturalWidth: 0` · `naturalHeight: 1601` · `naturalWidth: 10.5`(나머지는 유효한 짝)를 각각 넣는다
- **THEN** 네 경우 모두 `success === false`
