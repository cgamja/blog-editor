## ADDED Requirements

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
