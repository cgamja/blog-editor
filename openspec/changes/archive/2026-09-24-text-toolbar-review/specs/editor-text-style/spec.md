## MODIFIED Requirements

### Requirement: 마지막 색을 다시 건다

editor-core는 SHALL `rememberColor(color)`로 마지막 글자색 또는 배경색을 에디터 상태에 기억하고(문서는 바꾸지 않는다), `applyLastColor`가 고른 글자에 그 색을 다시 건다. 기억이 없으면 false다. `setTextStyle`은 스타일만 바꾸고 기억하지 않는다 — 부르는 쪽이 둘을 함께 부른다. 단축키는 `Mod-u` 밑줄 · `Mod-Shift-s` 취소선 · `Mod-Shift-h` 마지막 색이고, 셋 다 거절돼도 키를 삼킨다(브라우저 단축키로 빠져나가지 않는다).

#### Scenario: 마지막 색 다시 걸기

- **WHEN** `rememberColor({ key: "highlight", value: "#3366aa" })`를 부른 뒤 글자를 고르고 `applyLastColor`를 부른다
- **THEN** 그 글자는 `textStyle { highlight: "#3366aa" }`다

#### Scenario: 기억이 없으면 false

- **WHEN** 색을 기억한 적 없는 상태에서 `applyLastColor`를 부른다
- **THEN** false다

#### Scenario: setTextStyle은 기억하지 않는다

- **WHEN** `setTextStyle({ color: "brand" })`만 부른 뒤 `applyLastColor`를 부른다
- **THEN** false다

#### Scenario: 문서가 그대로여도 기억은 갱신된다

- **WHEN** 이미 `color: "brand"`인 글자를 고른 채 `rememberColor({ key: "color", value: "brand" })`를 부른다
- **THEN** true이고 문서는 그대로이며, 다른 글자에 `applyLastColor`를 부르면 `color: "brand"`가 걸린다

#### Scenario: 단축키 표

- **WHEN** `textStyleKeymap`을 본다
- **THEN** `Mod-u` · `Mod-Shift-s` · `Mod-Shift-h`가 있다

#### Scenario: 거절된 밑줄 단축키도 키를 삼킨다

- **WHEN** 빈 선택(커서)도 아닌 코드 블록 글자에서 `Mod-u` 커맨드를 부른다
- **THEN** true다(문서는 그대로)

## ADDED Requirements

### Requirement: 도구줄 표시 조건

editor-react는 SHALL `shouldShowToolbar(state)`로 도구줄을 띄울지 정한다. 스타일을 걸 수 있고, 선택이 글자 선택 또는 전체 선택(⌘A)이고, 한글 조합 중이 아니고, 편집할 수 있고, 편집 영역이나 도구줄에 포커스가 있고, 마우스로 끌어 고르는 중이 아닐 때만 true다.

#### Scenario: 글자 선택 · 전체 선택은 띄운다

- **WHEN** 조건이 모두 맞고 선택이 text, 또는 all이다
- **THEN** 둘 다 true다

#### Scenario: 마우스로 끄는 중 · 조합 중 · 노드 선택은 띄우지 않는다

- **WHEN** 다른 조건은 맞고 마우스로 끄는 중이거나, 조합 중이거나, 선택이 node다
- **THEN** 셋 다 false다
