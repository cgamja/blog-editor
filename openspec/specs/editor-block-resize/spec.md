# editor-block-resize Specification

## Purpose

그림 · 앱 스크린샷의 폭을 Notion처럼 좌우 가장자리 손잡이로 자유롭게 바꾼다(이슈 #81). 폭 계산은 DOM 없는 순수 함수이고, 끄는 동안은 문서를 바꾸지 않는 노드 장식으로 미리 보이며, 놓을 때 커맨드를 한 번 부른다.

## Requirements

### Requirement: 가운데 기준으로 폭을 대칭 조절한다

`@blog-editor/editor-core`는 SHALL 순수 함수 `resizedWidthPercent({ startPercent, startX, x, side, containerWidth })`를 export한다. 그림은 가운데 정렬이라 한쪽 손잡이를 dx 끌면 폭이 2dx 바뀐다(`side`가 `"left"`면 부호가 반대). 결과는 정수로 반올림하고 WIDTH_RANGE(25–100) 끝에서 멈춘다. `containerWidth`가 0 이하면 `startPercent`를 돌려준다.

#### Scenario: 오른쪽 손잡이를 밖으로 끌면 두 배로 넓어진다

- **WHEN** 폭 600px 본문, 시작 50%에서 오른쪽 손잡이를 30px 오른쪽으로 끈다
- **THEN** 60이다. 왼쪽 손잡이를 30px 왼쪽으로 끌어도 60이다

#### Scenario: 범위 끝에서 멈춘다

- **WHEN** 시작 50%에서 오른쪽 손잡이를 1000px 오른쪽으로, 또는 왼쪽 손잡이를 1000px 오른쪽으로 끈다
- **THEN** 100, 25다

### Requirement: 끄는 동안 폭을 미리 보인다

`@blog-editor/editor-core`는 SHALL `widthPreview()` 플러그인과 커맨드 `previewBlockWidth(pos, width | null)`을 export한다. 미리보기는 그 블록에 노드 장식(`post-block` 클래스 + `style="--w:N"`)을 달 뿐 문서를 바꾸지 않는다. 폭이 없는 그림은 래퍼 없이 그려지므로 클래스가 있어야 `--w`가 먹는다. 폭을 가질 수 없는 블록이거나 WIDTH_RANGE 밖의 폭이면 false다. 문서가 바뀌면 미리보기는 풀린다.

#### Scenario: 미리보기는 장식만 달고 되돌리기에 남지 않는다

- **WHEN** 그림 블록에 `previewBlockWidth(pos, 40)`
- **THEN** 그 블록 장식에 `post-block` 클래스와 style `--w:40`이 있고, 문서는 그대로다

#### Scenario: 문서가 바뀌면 풀린다

- **WHEN** 미리보기 중에 글자를 입력한다, 또는 문단에 `previewBlockWidth`
- **THEN** 앞은 장식이 사라지고, 뒤는 false다

### Requirement: 그림 · 앱 스크린샷 좌우 폭 손잡이

`BlogEditor`는 SHALL 그림 · 앱 스크린샷을 노드로 고르면 좌우 가장자리에 폭 손잡이(`ew-resize`)를 보인다. 끄는 동안 「가로 N%」와 미리보기를 보이고, 놓을 때 `setBlockWidth`를 한 번 부른다. 640px 미만에서는 숨긴다. 실브라우저로 확인한다.

#### Scenario: 오른쪽 손잡이를 끌어 폭을 바꾼다

- **WHEN** 실브라우저에서 그림을 고르고 오른쪽 손잡이를 왼쪽으로 끌어 놓는다
- **THEN** 저장 형식의 폭이 줄고 undo 한 번에 돌아온다
