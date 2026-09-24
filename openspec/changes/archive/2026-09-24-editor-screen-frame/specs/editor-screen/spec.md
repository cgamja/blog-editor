## ADDED Requirements

### Requirement: 편집 화면 틀의 옆 패널 탭은 키보드로 옮겨 다닌다

editor-react는 SHALL `tabIndexAfterKey(current, key, count)`를 두고, 옆 패널 탭은 이 값으로 다음 탭을 고른다. ←/→는 이전 · 다음 탭이고 끝에서는 반대쪽 끝으로 돈다. Home · End는 처음 · 마지막 탭이다. 그 밖의 키는 null이라 탭이 바뀌지 않는다.

#### Scenario: 오른쪽 화살표는 다음 탭, 마지막에서는 처음으로

- **WHEN** 탭 2개 중 0번에서 ArrowRight, 1번에서 ArrowRight를 누른다
- **THEN** 각각 1번, 0번이다

#### Scenario: 왼쪽 화살표는 이전 탭, 처음에서는 마지막으로

- **WHEN** 탭 2개 중 1번에서 ArrowLeft, 0번에서 ArrowLeft를 누른다
- **THEN** 각각 0번, 1번이다

#### Scenario: Home · End는 양 끝 탭

- **WHEN** 탭 3개 중 1번에서 Home, End를 누른다
- **THEN** 각각 0번, 2번이다

#### Scenario: 모르는 키는 탭을 바꾸지 않는다

- **WHEN** Enter나 Tab을 누른다
- **THEN** null이다

### Requirement: 편집 화면 틀은 연결되지 않은 머리줄 동작을 이유와 함께 막는다

`EditorScreen`은 SHALL 머리줄 동작(글 목록 · 미리보기 · 초안 저장 · 발행) 가운데 `actions`로 받지 않은 것을 누를 수 없는 버튼으로 두고, 이유 문장을 접근성 설명으로 연결한다. 버튼은 포커스를 받는다.

#### Scenario: 동작을 넘기지 않으면 이유가 붙는다

- **WHEN** 플레이그라운드에서 `actions` 없이 틀을 띄우고 「발행」 버튼을 본다
- **THEN** `aria-disabled="true"`이고 설명이 "저장 · 발행은 백오피스 화면(M3)에서 연결돼요"이며, 눌러도 아무 일이 없다(실브라우저 확인)

### Requirement: 플레이그라운드 기본 화면은 편집 화면 틀이다

플레이그라운드는 SHALL 기본으로 편집 화면 틀만 보이고, 주소에 `?dev`가 있을 때만 픽스처 고르기 · 커맨드 버튼 · 저장 형식 JSON을 보인다. `?fixture=<이름>`은 두 경우 모두 첫 픽스처를 고른다.

#### Scenario: 기본 주소에는 확인 도구가 없다

- **WHEN** 플레이그라운드를 주소 그대로 연다
- **THEN** 픽스처 고르기 · 커맨드 버튼 · JSON이 DOM에 없다(실브라우저 확인)

#### Scenario: ?dev면 확인 도구가 틀 아래에 있다

- **WHEN** `?dev&fixture=decorationMax`로 연다
- **THEN** 확인 도구가 보이고 픽스처가 decorationMax다(실브라우저 확인)
