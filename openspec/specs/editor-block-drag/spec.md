# editor-block-drag Specification

## Purpose

블록 손잡이(디자인 68:2)의 동작을 정한다. 손잡이를 끌어 최상위 블록을 임의의 블록 사이로 옮기고, 「블록 추가」 메뉴로 블록 뒤에 새 블록을 넣는다. 문서를 바꾸는 일은 editor-core 커맨드 한 번이고, 화면 좌표를 번호로 바꾸는 계산은 DOM 없는 순수 함수다(이슈 #59).

## Requirements

### Requirement: 최상위 블록을 임의의 블록 사이로 옮긴다

`@blog-editor/editor-core`는 SHALL `moveTopBlockTo(from, gap)` 커맨드를 export한다. `from`번째 최상위 블록을 gap(0 = 맨 앞, childCount = 맨 끝)으로 옮긴다. attrs(꾸미기 · 스티커)는 그대로이고, 한 트랜잭션이라 undo 한 번에 되돌아간다. 선택이 옮긴 블록 안이면 같은 글자 위치를 따라간다. gap이 제자리거나 범위 밖이면 dispatch 없이 `false`다. 결과 문서는 `docFromNode`를 통과한다.

#### Scenario: 첫 블록을 맨 끝으로 옮긴다

- **WHEN** 스티커 · 글꼴이 붙은 문단 A와 문단 B · C에서 `moveTopBlockTo(0, 3)`
- **THEN** B · C · A이고 A의 attrs가 같으며, undo 한 번이면 A · B · C다

#### Scenario: 마지막 블록을 맨 앞으로 옮기면 커서가 따라간다

- **WHEN** 문단 A · B · C에서 커서가 C의 둘째 글자 앞이고 `moveTopBlockTo(2, 0)`
- **THEN** C · A · B이고 커서는 C의 둘째 글자 앞이다

#### Scenario: 제자리 gap은 아무 일도 하지 않는다

- **WHEN** 문단 A · B · C에서 `moveTopBlockTo(1, 1)` 또는 `moveTopBlockTo(1, 2)`
- **THEN** false이고 dispatch하지 않는다

#### Scenario: 범위 밖 번호는 거부한다

- **WHEN** 블록 3개 문서에서 `moveTopBlockTo(3, 0)` 또는 `moveTopBlockTo(0, 4)`
- **THEN** false다

#### Scenario: 꾸미기 최대 픽스처에서 blockGuard를 통과한다

- **WHEN** decorationMax 픽스처에 blockGuard를 달고 첫 블록을 맨 끝으로 옮긴다
- **THEN** 트랜잭션이 적용되고 결과가 `docFromNode`를 통과한다

### Requirement: 포인터 y로 손잡이 블록과 놓일 자리를 고른다

`@blog-editor/editor-core`는 SHALL 순수 함수 `blockIndexAt(rects, y)` · `dropGapAt(rects, y)`를 export한다. `rects`는 최상위 블록 순서대로의 `{ top, bottom }`이다. `blockIndexAt`은 y를 품은 블록을 고르고, 블록 사이 여백이면 가까운 블록, 빈 배열이면 null이다. `dropGapAt`은 세로 중앙이 y보다 위인 블록의 개수다.

#### Scenario: 블록 사이 여백에서는 가까운 블록을 고른다

- **WHEN** rects가 [0,100] · [120,200]이고 y가 50 · 105 · 118 · 300
- **THEN** `blockIndexAt`은 0 · 0 · 1 · 1이다

#### Scenario: 블록 중앙을 기준으로 앞뒤 gap을 고른다

- **WHEN** rects가 [0,100] · [120,200]이고 y가 -10 · 40 · 60 · 150 · 170 · 999
- **THEN** `dropGapAt`은 0 · 0 · 1 · 1 · 2 · 2다

### Requirement: 최상위 블록 뒤에 고른 종류의 새 블록을 넣는다

`@blog-editor/editor-core`는 SHALL `INSERTABLE_BLOCKS`(문단 · 제목 2 · 제목 3 · 점 목록 · 번호 목록 · 인용 · 콜아웃 note/tip/warning · 구분선)와 커맨드 `insertBlockAfter(index, kind)`를 export한다. `index`번째 최상위 블록 바로 뒤에 그 종류의 빈 블록을 넣고, 커서를 새 블록의 첫 글자 자리에 둔다. 구분선처럼 글자를 품지 않는 블록이면 뒤에 빈 문단을 두고 커서를 거기에 둔다(바로 뒤가 이미 문단이면 그 문단). 한 트랜잭션이고, 결과는 blockGuard와 `docFromNode`를 통과한다. `index`가 범위 밖이거나 모르는 종류면 dispatch 없이 `false`다.

#### Scenario: 모든 종류를 넣으면 커서가 새 블록 안에 있다

- **WHEN** blockGuard를 단 문단 A · B에서 `INSERTABLE_BLOCKS`의 각 종류로 `insertBlockAfter(0, kind)`를 부른다
- **THEN** 둘째 블록이 그 종류이고, 커서는 새 블록 안(구분선이면 그 뒤 문단)이며, 결과가 `docFromNode`를 통과한다

#### Scenario: 넣기는 undo 한 번에 되돌아간다

- **WHEN** 문단 A · B에서 `insertBlockAfter(1, "heading2")` 뒤 undo
- **THEN** 문서가 A · B로 돌아온다

#### Scenario: 마지막 블록 뒤 구분선은 이어 쓸 문단을 만든다

- **WHEN** 문단 A 하나에서 `insertBlockAfter(0, "horizontalRule")`
- **THEN** A · 구분선 · 빈 문단이고 커서는 빈 문단 안이다

#### Scenario: 범위 밖 번호나 모르는 종류는 거부한다

- **WHEN** 블록 2개 문서에서 `insertBlockAfter(2, "paragraph")` 또는 `insertBlockAfter(0, "image")`
- **THEN** false다

### Requirement: 블록 추가 메뉴

`BlogEditor`는 SHALL 손잡이 왼쪽에 `<button aria-label="블록 추가" aria-haspopup="menu">`를 보인다. 누르면 `role="menu"`로 `INSERTABLE_BLOCKS` 항목(높이 44px)을 보인다. 방향키로 항목을 옮기고, Enter로 `insertBlockAfter`를 부르며, Esc로 닫고 + 버튼으로 포커스를 돌린다. 앱 스크린샷과 그림은 사진 올리기(M5) 뒤에 넣는다. 실브라우저로 확인한다.

#### Scenario: 메뉴에서 콜아웃(팁)을 고른다

- **WHEN** 실브라우저에서 첫 블록의 + 버튼을 눌러 "콜아웃 · 팁"을 고른다
- **THEN** 첫 블록 뒤에 tip 콜아웃이 생기고 커서가 그 안에 있다

### Requirement: 블록 옮기기 손잡이

`@blog-editor/editor-react`의 `BlogEditor`는 SHALL 마우스를 올린 최상위 블록 왼쪽에 `<button aria-label="블록 옮기기">`를 보인다. 끄는 동안에는 놓일 자리에 선을 보이고, 놓으면 `moveTopBlockTo`를 한 번 dispatch한다. Esc를 누르면 문서를 바꾸지 않는다. 한글 조합 중에는 끌기를 시작하지 않는다. 이 요구는 실브라우저 확인으로 검증한다(DOM 테스트 환경 없음, adr-019).

#### Scenario: 손잡이를 끌어 다른 블록 뒤에 놓는다

- **WHEN** 실브라우저에서 첫 블록에 마우스를 올려 손잡이를 셋째 블록 아래쪽 절반까지 끌어 놓는다
- **THEN** 첫 블록이 셋째 자리 뒤로 옮겨지고 콘솔 오류가 없다

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

`BlogEditor`는 SHALL 손잡이를 4px 넘게 끌면 블록의 반투명 잔상을 포인터와 함께 움직이고, 스크롤 상자 가장자리 48px 안에서는 자동 스크롤한다. 잔상은 본문 CSS(`post-body`)로 그리고 `inert`라 포커스를 받지 않는다. 끌기를 시작하면 열린 블록 메뉴는 닫힌다. 문서는 놓을 때 한 번만 바뀐다. 4px 안에서 떼면 `role="menu"` 블록 메뉴(바꾸기 · 복제 · 지우기)를 연다. 바꿀 수 없는 항목은 비활성이다. 이 요구는 실브라우저로 확인한다.

#### Scenario: 화면 아래 가장자리로 끌면 스크롤된다

- **WHEN** 실브라우저에서 첫 블록 손잡이를 본문 스크롤 상자 아래 가장자리까지 끌고 버틴다
- **THEN** 잔상이 보이고 스크롤 상자의 `scrollTop`이 늘어난다

#### Scenario: 손잡이를 누르면 블록 메뉴가 열린다

- **WHEN** 실브라우저에서 손잡이를 끌지 않고 눌렀다 떼고 「지우기」를 고른다
- **THEN** 그 블록이 지워지고 콘솔 오류가 없다

#### Scenario: 메뉴를 연 채 끌면 메뉴가 닫힌다

- **WHEN** 실브라우저에서 블록 메뉴를 연 채 손잡이를 끌어 놓고, 다른 블록에 마우스를 올린다
- **THEN** 메뉴가 닫혀 있고 손잡이가 새 블록 옆에 뜬다
