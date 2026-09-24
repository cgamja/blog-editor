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
