# decoration-panel Specification

## Purpose

오른쪽 「꾸미기」 패널(글씨체 · 스티커 · 움직임 · 미리 보기)과 그림 폭 도구줄의 상태를 EditorState에서 파생하고, 바꾸기는 editor-core 꾸미기 커맨드로만 한다(디자인 69:2, 이슈 #60).

## Requirements

### Requirement: 꾸미기 패널 상태는 편집 상태에서 파생된다

editor-react는 SHALL `decorationPanelStateOf(state)`를 export하고, 이 값은 선택의 첫 최상위 블록 이름 · 글씨체 · 움직임 · 폭 · 스티커 개수와 각 항목의 사용 가능 여부를 담는다. 사용 가능 여부는 editor-core 꾸미기 커맨드를 dispatch 없이 부른 답과 같고, 쓸 수 없으면 이유 문장이 있다.

#### Scenario: 문단에 커서가 있으면 모든 꾸미기를 쓸 수 있다

- **WHEN** `font: "jua"` 문단에 커서를 두고 패널 상태를 만든다
- **THEN** 대상은 "문단", 글씨체 값은 `jua`, 글씨체 · 움직임 · 스티커를 쓸 수 있고 폭 도구줄은 없다

#### Scenario: 가질 수 없는 속성은 이유와 함께 막힌다

- **WHEN** 코드 블록에 커서를 두고 패널 상태를 만든다
- **THEN** 글씨체는 "코드 블록에는 글씨체를 줄 수 없어요"로 막히고 움직임은 쓸 수 있다

#### Scenario: 그림을 고르면 폭 도구줄이 생긴다

- **WHEN** 폭이 없는 그림을 노드로 고르고 패널 상태를 만든다
- **THEN** 폭 도구줄의 대상은 그 그림 위치이고 값은 100이다

#### Scenario: 스티커가 상한이면 더 붙일 수 없다

- **WHEN** 스티커가 12개인 글의 문단에 커서를 두고 패널 상태를 만든다
- **THEN** 스티커는 "스티커는 글 하나에 12개까지예요"로 막힌다

#### Scenario: 대상 블록이 없으면 모두 막힌다

- **WHEN** 전체 선택이나 GapCursor에서 패널 상태를 만든다
- **THEN** 대상이 없고 글씨체 · 움직임 · 스티커가 "꾸밀 블록을 먼저 고르세요"로 막힌다

### Requirement: 패널의 선택지는 닫힌 집합과 같다

글씨체 · 움직임 · 스티커 선택지는 SHALL content-schema의 `FONTS` · `MOTIONS` · `STICKER_IDS`와 하나씩 짝이 맞고, 폭 버튼 값(50 · 70 · 100)은 `WIDTH_RANGE` 안이다.

#### Scenario: 선택지가 스키마 값을 빠짐없이 덮는다

- **WHEN** 패널 선택지 목록을 스키마 상수와 비교한다
- **THEN** 글씨체 · 스티커는 같은 값 집합이고, 움직임은 `MOTIONS`에 "없음"이 더해진 것이며, 폭 값은 모두 범위 안이다

### Requirement: 움직임 미리 보기는 고른 블록에 잠깐 장식을 단다

editor-core는 SHALL `motionPreview()` 플러그인과 `previewMotion` · `endMotionPreview` 커맨드를 export한다. `previewMotion`은 움직임이 있는 최상위 블록에 `editor-motion-preview` 노드 장식을 달고, 움직임이 없거나 대상이 없으면 `false`다. 문서는 바뀌지 않는다.

#### Scenario: 움직임이 있는 블록에 장식이 달리고 떼어진다

- **WHEN** `motion: "pop"` 문단에서 `previewMotion`을 실행하고 이어서 `endMotionPreview`를 실행한다
- **THEN** 첫 실행 뒤 그 문단 범위에 `editor-motion-preview` 장식이 있고 문서는 같으며, 둘째 실행 뒤 장식이 없다

#### Scenario: 움직임이 없으면 미리 보기를 거절한다

- **WHEN** 움직임이 없는 문단에서 `previewMotion`을 실행한다
- **THEN** `false`다

#### Scenario: 미리 보는 블록이 지워지면 장식도 사라진다

- **WHEN** 미리 보기 중인 블록을 지운다
- **THEN** 장식이 없다

### Requirement: 꾸미기 패널에 정렬이 있다

`decorationPanelStateOf(state)`는 SHALL 정렬 값(첫 대상 블록의 `alignOf`)과 사용 가능 여부를 담고, 패널과 그림 · 앱 스크린샷 폭 도구줄은 왼쪽 · 가운데 · 오른쪽 버튼으로 `setBlockAlign`을 부른다. 정렬할 수 없으면 이유 문장이 있다.

#### Scenario: 문단의 정렬 상태

- **WHEN** align 없는 문단에 커서를 두고 패널 상태를 만든다
- **THEN** 정렬 값은 `left`이고 쓸 수 있다

#### Scenario: 그림의 정렬 상태

- **WHEN** align 없는 그림을 노드로 고르고 패널 상태를 만든다
- **THEN** 정렬 값은 `center`이고 쓸 수 있다

#### Scenario: 목록은 정렬할 수 없다

- **WHEN** 목록 항목에 커서를 두고 패널 상태를 만든다
- **THEN** 정렬은 "목록에는 정렬을 줄 수 없어요"로 막힌다
