## ADDED Requirements

### Requirement: 에디터는 표를 저장 문서와 같은 모양으로 오간다

editor-core는 SHALL 표 노드 넷(`table` · `tableRow` · `tableCell` · 칸 안 `paragraph`)을 prosemirror-tables(`@tiptap/pm/tables`)가 읽는 `tableRole`과 함께 에디터 스키마에 둔다. prosemirror-tables가 읽는 `colspan` · `rowspan`(늘 1)은 에디터 스키마에만 있고 `docFromNode`가 지운다. 유효한 표 문서는 `docToNode` → `docFromNode`로 오가도 `normalize` 결과와 같다. `tableEditing` 플러그인이 켜져 있다 — README 권고대로 다른 확장보다 뒤(가장 낮은 우선순위 `TableEditing` 확장)에 둔다.

#### Scenario: 표 문서가 에디터를 오가도 같다

- **WHEN** 머리 행에 정렬이 있고 꾸미기(`font` · 스티커)가 있는 표 문서를 `docToNode` → `docFromNode`로 돌린다
- **THEN** 결과가 `normalize` 결과와 같고 `colspan` · `rowspan` 키가 없다

### Requirement: 표를 넣고 칸 사이를 키보드로 옮겨 다닌다

editor-core는 SHALL 넣을 수 있는 블록(`INSERTABLE_BLOCKS`)에 `table`을 둔다 — 넣으면 2열 × 2행(첫 행 머리) 빈 표이고 커서는 첫 칸에 있다. 표 안에서 Tab은 다음 칸, Shift+Tab은 앞 칸으로 옮기고 칸 글자를 고른다. 마지막 칸에서 Tab은 아래에 행을 더하고 새 행 첫 칸으로 간다. 첫 칸에서 Shift+Tab은 아무것도 바꾸지 않는다. 칸 안 Enter는 문서를 바꾸지 않는다(칸에는 문단이 하나뿐이다). 한글 조합 중에는 키를 가로채지 않는다.

#### Scenario: 넣은 표에서 Tab으로 칸을 옮기고 마지막 칸에서 행을 더한다

- **WHEN** 빈 문단 자리에 표를 넣고, 첫 칸에 `가`를 치고 Enter를 누른 뒤 Tab을 네 번 누른다
- **THEN** Enter는 문서를 바꾸지 않고, 첫 Tab 뒤 커서는 첫 행 둘째 칸, 둘째 Tab 뒤 둘째 행 첫 칸, 넷째 Tab(마지막 칸) 뒤 표는 3행이고 커서는 새 행 첫 칸이며, 첫 칸 글자는 `가`다

### Requirement: 행 · 열을 더하고 지우며 열 정렬을 바꾼다

editor-core는 SHALL 커서가 든 칸을 기준으로 `addTableRowAfter` · `addTableColumnAfter` · `deleteTableRow` · `deleteTableColumn` · `setTableColumnAlign(align)`을 export한다. 표 밖이면 모두 false다. 마지막 남은 행 · 열은 지우지 않는다(false). 머리 행을 지우면 다음 행이 머리 행이 되고 열 정렬은 새 머리 행으로 옮긴다. 열 정렬은 머리 행 칸에만 저장하고 `left`는 저장하지 않는다. 정렬 단축키(⌘⇧L · E · R)는 표 안에서 열 정렬을 바꾼다. editor-react 블록 메뉴는 손잡이 블록이 표일 때 「아래에 행 추가 · 오른쪽에 열 추가 · 행 지우기 · 열 지우기」를 보이고, 커서가 그 표 안에 없으면 마지막 행 · 열을 기준으로 한다. 에디터는 열 정렬을 본문 칸에도 보이게 그린다.

#### Scenario: 행 · 열을 더하고 지운다

- **WHEN** 2×2 표 첫 칸에서 `addTableColumnAfter` · `addTableRowAfter`를 차례로 부르고, 이어 `deleteTableRow` · `deleteTableColumn`을 부른다
- **THEN** 표가 3열 × 2행 → 3열 × 3행 → 3열 × 2행 → 2열 × 2행이 되고 매번 `docSchema`를 통과한다

#### Scenario: 머리 행을 지우면 정렬이 새 머리 행으로 간다

- **WHEN** 둘째 열이 `right`인 3행 표의 머리 행 칸에서 `deleteTableRow`를 부른다
- **THEN** 표는 2행이고 새 첫 행 둘째 칸의 `align`이 `right`이며 다른 칸에는 `align`이 없다

#### Scenario: 본문 칸에서 열 정렬을 바꾸면 머리 행 칸에 저장한다

- **WHEN** 2×2 표 둘째 행 둘째 칸에서 `setTableColumnAlign("center")`, 이어 `setTableColumnAlign("left")`를 부른다
- **THEN** 첫 호출 뒤 첫 행 둘째 칸만 `align: "center"`이고, 둘째 호출 뒤에는 어느 칸에도 `align`이 없다

#### Scenario: 마지막 행 · 열과 표 밖은 거절한다

- **WHEN** 1행 표에서 `deleteTableRow`, 1열 표에서 `deleteTableColumn`, 표 밖 문단에서 `addTableRowAfter`를 부른다
- **THEN** 셋 다 false이고 문서가 그대로다

#### Scenario: 실브라우저에서 슬래시 메뉴로 표를 넣으면 미리보기에 표가 보인다

- **WHEN** 실브라우저(Chromium · WebKit)에서 빈 문단에 `/표`를 치고 Enter, 첫 칸 `이름` · Tab · `값` · Tab · `가`를 친 뒤 미리보기를 연다
- **THEN** 미리보기에 `th` `이름` · `값`과 `td` `가`가 있는 표가 보인다
