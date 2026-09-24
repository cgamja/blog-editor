# design — block-drag-handle

## 1. 포인터 이벤트로 끈다. HTML5 DnD를 쓰지 않는다

ProseMirror는 편집 영역의 `dragstart` · `drop`을 스스로 처리한다. 선택 영역을 Slice로 직렬화해 놓는 자리에 붙여 넣고(`view.dragging`), 우리 붙여넣기 정규화(pasteNormalizer)도 거친다. 블록 순서만 바꾸는 일에 직렬화와 정규화는 필요 없다. 그 경로를 타면 꾸미기 attrs가 걸러질 수 있고, 드롭 위치도 글자 단위라 블록 사이로 제한되지 않는다.

그래서 손잡이는 `pointerdown`에서 포인터를 잡고(`setPointerCapture`), 움직이는 동안 놓일 gap을 계산해 선으로 보인다. `pointerup`에서 `moveTopBlockTo` 트랜잭션 하나를 dispatch한다. 편집 영역의 drop 이벤트는 쓰지 않는다.

근거:

- https://prosemirror.net/docs/ref/#view.EditorView.dragging
- https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture

## 2. 옮기기는 editor-core 순수 커맨드

`moveTopBlockTo(from, gap)`는 `(state, dispatch) => boolean` 커맨드다.

- `from`번째 노드를 지우고, gap 자리(지운 뒤 좌표로 환산)에 같은 노드를 넣는다.
- 노드 객체를 그대로 쓰니 attrs · 스티커가 바뀔 틈이 없다(adr-008 블록 상대 좌표). 한 트랜잭션이라 undo 한 번에 되돌아간다.
- gap이 제자리(`from` 또는 `from + 1`)거나 범위 밖이면 dispatch 없이 false다.
- 선택
  - 옮긴 블록 안에 있으면 옮긴 거리만큼 평행 이동한다. `Selection.map` + `StepMap.offset`, #43과 같은 방식이다.
  - 그 밖이면 트랜잭션 기본 매핑을 따른다.

기존 `moveBlockUp/Down`은 "이웃 한 칸과 자리 바꾸기"라 임의 gap을 표현하지 못한다. 그래서 새 커맨드를 두고, `blockStart` 계산만 같은 방식으로 한다.

## 3. 기하 계산은 숫자만 받는다

손잡이가 붙을 블록(`blockIndexAt`)과 놓일 gap(`dropGapAt`)은 최상위 블록마다 `{ top, bottom }`(getBoundingClientRect)의 배열과 y만 받는다.

- `blockIndexAt`: y를 품은 블록이다. 블록 사이 여백이면 가까운 블록, 블록이 없으면 null이다.
- `dropGapAt`: 세로 중앙이 y보다 위인 블록의 개수다. 블록 위쪽 절반이면 그 앞, 아래쪽 절반이면 그 뒤다.

DOM에서 사각형을 읽는 일은 editor-react가 한다. `view.nodeDOM(블록 시작 위치)`로 최상위 블록 DOM을 얻는다.

- https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM

## 4. 손잡이 접근성

- 손잡이는 실제 `<button aria-label="블록 옮기기">`다. 디자인이 정한 접근성이고, 스크린 리더의 요소 목록에도 이름이 나온다.
- 다만 `tabIndex=-1`로 Tab 순서에서는 뺀다. 마우스를 올린 블록에만 뜨는 버튼이라, Tab으로 닿으면 어느 블록 것인지 알 수 없다.
- 키보드 사용자는 커서가 있는 블록을 `Mod-Shift-ArrowUp/Down`(#43)으로 옮긴다. 버튼 `title`에 그 단축키를 적는다.
- `view.composing`(한글 조합) 중에는 끌기를 시작하지 않는다(.claude/rules/editor.md).
- `pointerdown`의 기본 동작을 막는다. 편집 영역의 포커스와 선택이 손잡이 쪽으로 튀지 않게 하기 위해서다.
