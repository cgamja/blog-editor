## ADDED Requirements

### Requirement: 최상위 블록을 지운다

`@blog-editor/editor-core`는 SHALL `deleteTopBlock(index)` 커맨드를 export한다. `index`번째 최상위 블록을 지우고 커서를 그 자리 블록(없으면 앞 블록 끝)에 둔다. 마지막 남은 블록이면 빈 문단으로 바꾼다. 한 트랜잭션이라 undo 한 번에 되돌아간다. 범위 밖 번호면 dispatch 없이 `false`다.

#### Scenario: 가운데 블록을 지운다

- **WHEN** 문단 A · B · C에서 `deleteTopBlock(1)` 뒤 undo
- **THEN** 지운 직후는 A · C이고 커서는 C 안이며, undo 한 번에 A · B · C다

#### Scenario: 하나 남은 블록을 지우면 빈 문단이 된다

- **WHEN** 문단 A 하나에서 `deleteTopBlock(0)`, 또는 블록 1개 문서에서 `deleteTopBlock(1)`
- **THEN** 앞은 빈 문단 하나, 뒤는 false다

### Requirement: 손잡이 블록에 커맨드를 부른다

`@blog-editor/editor-core`는 SHALL `atTopBlock(index, command)`를 export한다. 선택을 `index`번째 최상위 블록으로 옮긴 상태로 `command`를 부른다. 글자를 품은 블록이면 첫 글자 자리, atom이면 노드 선택이다. 만든 트랜잭션은 원래 상태에 적용된다. 또 SHALL `TURN_INTO_TARGETS`(문단 · 큰 제목 · 작은 제목 · 점 목록 · 번호 목록 · 인용 · 코드)와 `turnTopBlockInto(index, kind)`를 export한다.

#### Scenario: 커서가 없는 블록을 제목으로 바꾼다

- **WHEN** 커서가 문단 A 안인 A · B 문서에서 `turnTopBlockInto(1, "heading2")`
- **THEN** B가 큰 제목이 되고 A는 그대로이며, 결과가 `docFromNode`를 통과한다

#### Scenario: 손잡이 블록을 복제하고 목록으로 감싼다

- **WHEN** 커서가 A 안인 A · B에서 `atTopBlock(1, duplicateTopBlock)`, 또는 `turnTopBlockInto(0, "bulletList")`
- **THEN** 앞은 A · B · B, 뒤는 A가 점 목록 안이다

#### Scenario: 공유 트랜잭션에서도 바꾸기가 담긴다

- **WHEN** TipTap 체인처럼 `state.tr`가 늘 같은 트랜잭션을 돌려주고 dispatch는 아무것도 하지 않는 상태에서 `turnTopBlockInto(1, "heading2")`
- **THEN** 그 공유 트랜잭션을 적용하면 B가 큰 제목이다

#### Scenario: 바꿀 수 없으면 거부한다

- **WHEN** 구분선 블록에 `turnTopBlockInto(i, "heading2")`, 또는 범위 밖 번호
- **THEN** false이고 dispatch하지 않는다

### Requirement: 끄기와 블록 메뉴

`BlogEditor`는 SHALL 손잡이를 4px 넘게 끌면 블록의 반투명 잔상을 포인터와 함께 움직이고, 스크롤 상자 가장자리 48px 안에서는 자동 스크롤한다. 문서는 놓을 때 한 번만 바뀐다. 4px 안에서 떼면 `role="menu"` 블록 메뉴(바꾸기 · 복제 · 지우기)를 연다. 바꿀 수 없는 항목은 비활성이다. 이 요구는 실브라우저로 확인한다.

#### Scenario: 화면 아래 가장자리로 끌면 스크롤된다

- **WHEN** 실브라우저에서 첫 블록 손잡이를 본문 스크롤 상자 아래 가장자리까지 끌고 버틴다
- **THEN** 잔상이 보이고 스크롤 상자의 `scrollTop`이 늘어난다

#### Scenario: 손잡이를 누르면 블록 메뉴가 열린다

- **WHEN** 실브라우저에서 손잡이를 끌지 않고 눌렀다 떼고 「지우기」를 고른다
- **THEN** 그 블록이 지워지고 콘솔 오류가 없다
