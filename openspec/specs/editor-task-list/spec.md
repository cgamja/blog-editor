# editor-task-list Specification

## Purpose

에디터의 할 일 목록(체크리스트) — 목록 항목의 `checked`를 체크 칸으로 그리고 누르기 · `[ ] ` 입력 · 「바꾸기」로 만들고 켠다. 저장 형식과 공개 HTML은 markdown-format · html-render가 정한다(#132, adr-036).

## Requirements

### Requirement: 에디터 목록 항목은 체크 여부를 오간다

editor-core 스키마의 `listItem`은 SHALL `checked` attr을 가진다(기본 없음). 에디터 HTML은 할 일 항목을 `<li data-checked="true|false">`로 낸다. 붙여넣은 HTML에서는 `li[data-checked]`와 공개 HTML의 `li.post-task`(안 체크 칸의 `checked`)를 할 일 항목으로 읽는다. 저장 문서 → 에디터 → 저장 문서는 `checked`까지 같다.

#### Scenario: 할 일 항목 문서가 에디터를 오간다

- **WHEN** `checked: false` · `checked: true` · 없음 항목과 안쪽 할 일 항목이 든 문서를 `docToNode` → `docFromNode`한다
- **THEN** 결과가 입력과 deep-equal이다

#### Scenario: 공개 HTML의 할 일 항목을 붙여넣는다

- **WHEN** `<ul><li class="post-task"><p><input type="checkbox" disabled checked aria-label="완료">끝</p></li><li data-checked="false"><p>할 일</p></li></ul>`을 에디터 스키마로 파싱한다
- **THEN** 두 항목의 `checked`가 차례로 `true` · `false`이고 글은 `끝` · `할 일`이다

### Requirement: 체크 칸을 누르면 체크가 바뀐다

editor-core는 SHALL 순수 커맨드 `toggleTaskItem(pos)`를 export한다. `pos`의 노드가 할 일 항목이면 `checked`를 뒤집고 true, 아니면 false다. 체크 칸은 NodeView · 위젯 없이 CSS(`li[data-checked]::before`)로 그리고, 누르기 플러그인이 할 일 항목 요소 자체(글 문단이 아닌 체크 칸 자리 — 첫 문단 높이 안의 왼쪽 여백)를 누른 mousedown만 받아 토글한다(adr-036). 조합(IME) 중에는 문서를 바꾸지 않는다.

#### Scenario: 토글 커맨드

- **WHEN** 할 일 항목(`checked: false`)에 `toggleTaskItem`을 두 번 적용하고, 보통 항목에 한 번 적용한다
- **THEN** 할 일 항목은 `true` → `false`가 되고, 보통 항목에서는 false를 돌려주며 문서가 바뀌지 않는다

#### Scenario: 실브라우저에서 체크 칸을 누른다

- **WHEN** Chromium · WebKit에서 할 일 항목의 체크 칸 자리를 누른다
- **THEN** 항목이 체크되고(`data-checked="true"`), 미리보기에 `checked` 체크 칸이 보인다

#### Scenario: 안쪽 목록 옆 왼쪽 여백은 체크 칸이 아니다

- **WHEN** Chromium · WebKit에서 안쪽 목록이 있는 할 일 항목의 첫 줄보다 아래(안쪽 목록 높이) 왼쪽 여백을 누른다
- **THEN** 바깥 항목의 체크가 그대로다(`data-checked="false"`) — 체크 칸은 첫 문단 높이 안의 왼쪽 여백만이다

### Requirement: `[ ] ` · `[x] ` 입력이 할 일 항목을 만든다

입력 규칙은 SHALL 목록 항목 첫 문단 맨 앞이나 최상위 문단 맨 앞에서 `[ ] ` · `[x] ` · `[X] `를 입력하면 표시 글자를 지우고 할 일 항목으로 바꾼다. 목록 항목이면 그 항목에 `checked`를 싣고, 최상위 문단이면 점 목록으로 감싼 뒤 싣는다(꾸미기는 목록으로 옮긴다). 이미 할 일 항목이면 걸리지 않는다. 조합 중에는 걸리지 않는다(prosemirror-inputrules).

#### Scenario: 목록 항목 · 최상위 문단에서 할 일 표지를 친다

- **WHEN** 점 목록 항목 맨 앞에서 `[ ] `를, 빈 최상위 문단에서 `[x] `를 입력한다
- **THEN** 앞은 `checked: false` 항목, 뒤는 `checked: true` 항목 하나인 점 목록이 되고 표시 글자는 없다

#### Scenario: 실브라우저에서 `- [ ] `를 친다

- **WHEN** Chromium · WebKit 빈 문단에서 `- [ ] 우유`를 친다
- **THEN** `data-checked="false"` 항목 하나인 점 목록이 되고 글은 `우유`다

### Requirement: 할 일 항목에서 Enter로 만든 새 항목은 체크하지 않은 할 일이다

목록 항목 나누기(Enter)는 SHALL 할 일 항목을 나눌 때 새 항목을 `checked: false`로 둔다(나누기는 옛 항목 attrs를 복사한다 — prosemirror-transform split). 원래 항목의 체크는 그대로다. 글 맨 앞에서 나누면 위에 생기는 빈 항목이 새 항목이다. 보통 항목을 나누면 지금처럼 보통 항목이다.

#### Scenario: 끝난 할 일 항목을 나눈다

- **WHEN** 끝난 할 일 항목(`checked: true`) `우유` 끝에서, 그리고 맨 앞에서 각각 Enter를 누른다
- **THEN** 끝에서는 `우유`(`true`) 뒤에 빈 `checked: false` 항목이, 맨 앞에서는 빈 `checked: false` 항목 뒤에 `우유`(`true`)가 있다

### Requirement: 블록 메뉴와 `/` 메뉴에 할 일 목록이 있다

블록 메뉴 「바꾸기」와 「+」 · `/` 메뉴는 SHALL 「할 일 목록」을 둔다. 바꾸기는 최상위 문단을 점 목록으로 감싸고 감싼 목록의 항목을 모두 `checked: false`로 만든다(`wrapInTaskList`). 감싼 목록이 최상위가 아니어도(콜아웃 안 문단) 같다. 이미 목록이면 그 목록의 모든 항목을 할 일 항목으로 만든다(`checked`가 있던 항목은 그대로). 넣기는 `checked: false` 항목 하나인 빈 점 목록을 넣는다.

#### Scenario: 문단 · 목록을 할 일 목록으로 바꾸고 새로 넣는다

- **WHEN** 글이 있는 최상위 문단에 「바꾸기 → 할 일 목록」을, 보통 점 목록에 같은 바꾸기를 적용하고, 문단 뒤에 「할 일 목록」을 넣는다
- **THEN** 문단은 `checked: false` 항목 하나인 점 목록, 점 목록은 보통 항목이 `checked: false`가 되고 체크된 항목은 그대로, 넣은 블록은 빈 `checked: false` 항목 하나인 점 목록이다

#### Scenario: 콜아웃 안 문단을 할 일 목록으로 바꾼다

- **WHEN** 문단 `우유` 하나가 든 콜아웃에 「바꾸기 → 할 일 목록」을 적용한다
- **THEN** 성공하고 콜아웃 안에 감싼 점 목록의 모든 항목이 `checked: false`다
