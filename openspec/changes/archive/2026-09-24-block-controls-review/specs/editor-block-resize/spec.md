## MODIFIED Requirements

### Requirement: 가운데 기준으로 폭을 대칭 조절한다

`@blog-editor/editor-core`는 SHALL 순수 함수 `resizedWidthPercent({ startPercent, startX, x, side, containerWidth, align })`를 export한다. 가운데 정렬(`align`이 없거나 `"center"`)이면 한쪽 손잡이를 dx 끌 때 폭이 2dx 바뀐다. 왼쪽 · 오른쪽 정렬이면 한쪽이 고정이라 dx 바뀐다. `side`가 `"left"`면 부호가 반대다. 결과는 정수로 반올림하고 WIDTH_RANGE(25–100) 끝에서 멈춘다. `containerWidth`가 0 이하면 `startPercent`를 돌려준다.

#### Scenario: 오른쪽 손잡이를 밖으로 끌면 두 배로 넓어진다

- **WHEN** 폭 600px 본문, 시작 50%에서 오른쪽 손잡이를 30px 오른쪽으로 끈다
- **THEN** 60이다. 왼쪽 손잡이를 30px 왼쪽으로 끌어도 60이다

#### Scenario: 한쪽 정렬이면 끈 만큼만 바뀐다

- **WHEN** 폭 600px 본문, 시작 50%, `align: "left"`에서 오른쪽 손잡이를 30px 오른쪽으로, `align: "right"`에서 왼쪽 손잡이를 30px 왼쪽으로 끈다
- **THEN** 둘 다 55다

#### Scenario: 범위 끝에서 멈춘다

- **WHEN** 시작 50%에서 오른쪽 손잡이를 1000px 오른쪽으로, 또는 왼쪽 손잡이를 1000px 오른쪽으로 끈다
- **THEN** 100, 25다
