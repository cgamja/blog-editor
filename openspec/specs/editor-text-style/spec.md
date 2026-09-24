# editor-text-style Specification

## Purpose

글자를 골라 글꼴 · 두께 · 크기 · 글자색 · 배경색(ADR-020 `textStyle`)과 굵게 · 기울임 · 밑줄 · 취소선 · 코드 · 링크를 거는 서식 도구줄과 그 커맨드. 속성은 글자 조각마다 합치고, 두께는 글꼴에 있는 것만, 색 대비가 낮으면 경고한다(이슈 #85).

## Requirements

### Requirement: 고른 글자의 글자 스타일 속성을 합친다

editor-core는 SHALL `setTextStyle(patch)`를 두고, 고른 범위의 텍스트 조각마다 지금 `textStyle` 속성에 patch를 덮어쓴 값을 건다. patch의 `null`은 그 속성을 지운다. 속성이 모두 비면 `textStyle` 마크를 뗀다. 결과는 content-schema `textStyleAttrsSchema`를 통과해야 한다.

#### Scenario: 글자색을 건다

- **WHEN** 문단 글자 일부를 고르고 `setTextStyle({ color: "brand" })`를 부른다
- **THEN** true이고 그 글자에 `textStyle { color: "brand" }`가 있다

#### Scenario: 이미 있는 속성은 두고 새 속성을 더한다

- **WHEN** `textStyle { size: "lg" }`인 글자를 고르고 `setTextStyle({ color: "brand" })`를 부른다
- **THEN** 그 글자는 `textStyle { size: "lg", color: "brand" }`다

#### Scenario: 조각마다 제 속성을 지킨다

- **WHEN** `size: "lg"` 조각과 스타일 없는 조각을 함께 고르고 `setTextStyle({ color: "brand" })`를 부른다
- **THEN** 앞 조각은 `{ size: "lg", color: "brand" }`, 뒤 조각은 `{ color: "brand" }`다

#### Scenario: 마지막 속성을 지우면 마크를 뗀다

- **WHEN** `textStyle { color: "brand" }`인 글자를 고르고 `setTextStyle({ color: null })`을 부른다
- **THEN** 그 글자에 `textStyle` 마크가 없다

#### Scenario: 정의 밖 값은 거절한다

- **WHEN** `setTextStyle({ color: "pink" })` 또는 `setTextStyle({ color: "#FFF" })`를 부른다
- **THEN** false이고 문서는 그대로다

#### Scenario: 결과는 저장 형식을 통과한다

- **WHEN** blockGuard를 단 상태에서 글꼴 · 두께 · 크기 · 글자색 · 배경색을 차례로 건다
- **THEN** 매번 true이고 `docFromNode`가 결과 문서를 받는다

### Requirement: 두께는 그 글꼴에 있는 것만

`setTextStyle`은 SHALL 결과 두께가 그 조각의 글꼴(없으면 Pretendard)에 없으면 두께를 고르는 patch를 거절한다. 글꼴을 바꾸는 patch로 기존 두께가 맞지 않게 되면 그 조각의 두께를 뗀다.

#### Scenario: 글꼴에 없는 두께는 거절한다

- **WHEN** `textStyle { font: "jua" }`인 글자를 고르고 `setTextStyle({ weight: "light" })`를 부른다
- **THEN** false이고 문서는 그대로다

#### Scenario: 글꼴을 바꾸면 맞지 않는 두께를 뗀다

- **WHEN** `textStyle { weight: "heavy" }`인 글자를 고르고 `setTextStyle({ font: "gaegu" })`를 부른다
- **THEN** 그 글자는 `textStyle { font: "gaegu" }`다

### Requirement: 바꿀 것이 없으면 기록을 남기지 않는다

`setTextStyle`은 SHALL 결과가 지금 문서와 같으면 true를 돌려주되 dispatch하지 않는다. 고른 글자가 없거나 마크를 받지 못하는 곳(코드 블록)이면 false다.

#### Scenario: 같은 값은 dispatch하지 않는다

- **WHEN** `textStyle { color: "brand" }`인 글자를 고르고 `setTextStyle({ color: "brand" })`를 부른다
- **THEN** true이고 dispatch가 불리지 않는다

#### Scenario: 대상이 없으면 false

- **WHEN** 빈 선택(커서)에서, 또는 코드 블록 글자를 고르고 `setTextStyle({ color: "brand" })`를 부른다
- **THEN** 둘 다 false다

### Requirement: 도구줄이 보일 값을 요약한다

editor-core는 SHALL `textStyleSummary(state)`를 두고, 고른 범위의 속성마다 값 하나 · 없음(null) · 여러 값(`MIXED`)을, 마크(굵게 · 기울임 · 밑줄 · 취소선 · 코드)마다 모든 글자에 걸렸는지를, 스타일을 걸 수 있는지(`canStyle`)를 돌려준다.

#### Scenario: 섞인 값은 MIXED

- **WHEN** `color: "brand"` 조각과 `color: "red"` 조각, 그리고 둘 다 굵게인 글자를 함께 고른다
- **THEN** color는 `MIXED`, size는 null, bold는 true, italic은 false, canStyle은 true다

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

### Requirement: 색 대비가 낮으면 경고한다

editor-react는 SHALL 글자색(없으면 본문 잉크)과 바탕(배경색, 없으면 종이 흰색)의 WCAG 대비를 재고 4.5:1 미만이면 경고한다. 프리셋은 이름을 design/tokens.json 값으로 바꿔 잰다. 적용은 막지 않는다.

#### Scenario: 검정과 흰색의 대비는 21

- **WHEN** `contrastRatio("#000000", "#ffffff")`를 잰다
- **THEN** 21이다

#### Scenario: 프리셋 글자색은 경고하지 않고 옅은 직접 색은 경고한다

- **WHEN** 글자색 프리셋 넷을 각각, 그리고 `{ color: "#dddddd" }`를 잰다
- **THEN** 프리셋은 모두 읽을 만하고, `#dddddd`는 읽기 어렵다

### Requirement: 직접 입력 색을 정규형으로 받는다

editor-react는 SHALL `#` 입력을 앞뒤 공백을 떼고 `#`을 붙이고 소문자로 바꿔 `#rrggbb`로 받는다. 6자리 16진이 아니면 null이다.

#### Scenario: hex 입력 정리

- **WHEN** `" #AABBCC "`, `"aabbcc"`, `"#abc"`, `"#gggggg"`를 넣는다
- **THEN** 앞 둘은 `"#aabbcc"`, 뒤 둘은 null이다

### Requirement: 도구줄은 선택 위, 자리가 없으면 아래

editor-react는 SHALL 도구줄을 선택 시작 글자 위에 틈을 두고 놓고, 보이는 영역(가장 가까운 세로 스크롤 상자, 없으면 창) 위쪽까지 자리가 없으면 선택 아래에 놓는다. 좌표는 기준 틀 안이고, 보이는 영역은 틀보다 위에서 시작할 수 있다(종이 여백).

#### Scenario: 위에 자리가 있으면 위

- **WHEN** 선택 위쪽이 틀 안 100px, 도구줄 높이 48px, 틈 8px이다
- **THEN** top은 44이고 아래가 아니다

#### Scenario: 위에 자리가 없으면 아래

- **WHEN** 선택 위쪽이 틀 안 20px, 아래쪽이 40px, 도구줄 높이 48px, 틈 8px이다
- **THEN** top은 48이고 아래다

#### Scenario: 보이는 영역이 틀보다 위에서 시작하면 틀 위로 올라간다

- **WHEN** 선택 위쪽이 틀 안 0px(첫 줄), 보이는 영역 위쪽이 틀 안 -64px(종이 여백), 도구줄 높이 48px, 틈 8px이다
- **THEN** top은 -56이고 아래가 아니다

### Requirement: 두께 선택지는 글꼴을 따른다

editor-react는 SHALL 요약된 글꼴(없으면 Pretendard)에 있는 두께만 선택지로 보이고, 글꼴이 섞였거나 쓸 두께가 없으면 선택지를 비우고 이유를 돌려준다.

#### Scenario: 글꼴별 두께 선택지

- **WHEN** 글꼴이 null · gaegu · jua · MIXED일 때 두께 선택지를 구한다
- **THEN** 각각 light · medium · heavy, light만, 없음(이유 있음), 없음(이유 있음)이다

### Requirement: 글자를 고르면 서식 도구줄이 뜬다

editor-react `TextToolbar`는 SHALL 글자를 고르면(한글 조합 중이 아니고 스타일을 걸 수 있을 때) 굵게 · 기울임 · 밑줄 · 취소선 · 코드 · 링크 · 글꼴 · 두께 · 크기 · 글자색 · 배경색 도구줄을 role="toolbar"로 띄우고, 섞인 값은 "여러 값"으로 보인다. 버튼은 편집 영역의 선택을 빼앗지 않는다.

#### Scenario: 글꼴 · 크기 · 색을 도구줄로 건다(실브라우저)

- **WHEN** 플레이그라운드에서 글자를 고르고 도구줄로 글꼴 Jua, 크기 크게, 글자색 brand를 고른다
- **THEN** 그 글자가 `span.post-ts[data-font="jua"][data-size="lg"][data-color="brand"]`로 보이고 콘솔 오류가 없다

#### Scenario: 옅은 직접 색은 경고한다(실브라우저)

- **WHEN** 글자색에 `#dddddd`를 넣는다
- **THEN** "읽기 어려울 수 있어요"가 보이고, 적용하면 `data-color="custom"`이다

### Requirement: 도구줄 표시 조건

editor-react는 SHALL `shouldShowToolbar(state)`로 도구줄을 띄울지 정한다. 스타일을 걸 수 있고, 선택이 글자 선택 또는 전체 선택(⌘A)이고, 한글 조합 중이 아니고, 편집할 수 있고, 편집 영역이나 도구줄에 포커스가 있고, 마우스로 끌어 고르는 중이 아닐 때만 true다.

#### Scenario: 글자 선택 · 전체 선택은 띄운다

- **WHEN** 조건이 모두 맞고 선택이 text, 또는 all이다
- **THEN** 둘 다 true다

#### Scenario: 마우스로 끄는 중 · 조합 중 · 노드 선택은 띄우지 않는다

- **WHEN** 다른 조건은 맞고 마우스로 끄는 중이거나, 조합 중이거나, 선택이 node다
- **THEN** 셋 다 false다
