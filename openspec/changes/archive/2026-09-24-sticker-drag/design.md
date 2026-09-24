# Design — sticker-drag

## 1. 오버레이는 ProseMirror DOM 밖에 둔다

- 스티커 `img`는 #58에서 노드 toDOM 안(`div.post-block` 래퍼, `contenteditable=false`, `pointer-events: none`)에 있다. ProseMirror가 관리하는 DOM이라 끄는 동안 style을 바꾸면 DOMObserver가 변경으로 읽는다(https://prosemirror.net/docs/guide/#view.efficient_updating).
- 그래서 에디터 옆 형제 요소 `StickerLayer`(absolute)에 스티커마다 투명 `button`을 같은 자리에 겹친다.
  - 포인터 · 키보드 이벤트가 ProseMirror에 닿지 않는다. handleDOMEvents로 mousedown을 가로챌 필요가 없다.
  - 버튼이 Tab 순서에 들어가 키보드로 스티커에 닿는다(포인터 전용 손잡이의 대체).
- 끄는 동안에는 문서를 바꾸지 않는다. 오버레이에 유령 이미지(반투명)만 그리고, 놓을 때 커맨드 1번 → 트랜잭션 1번 → undo 1번이다.
- `view.composing` 중에는 포인터 · 키 조작을 무시한다(CLAUDE.md: 조합 중 문서 변경 미룸).

## 2. 고른 스티커 참조

- 스티커에는 id가 없다(#57 design 2). 그래서 `(blockPos, index)` 참조를 React 상태로 들고, 트랜잭션마다 `mapStickerRef`로 옮긴다.
- `mapping.mapResult(pos, 1)`: 블록 앞에 무엇이 들어오면 따라간다. 블록이 지워지면 `deleted`가 되어 null이다(https://prosemirror.net/docs/ref/#transform.Mapping.mapResult). 블록을 옮기는 것은 지웠다 넣는 것이라 선택이 풀린다. 받아들인다.
- 순번이 범위 밖이면 null이다. 같은 블록의 앞 스티커가 지워지면 선택이 풀린다. 스티커가 바뀌어 보이는 것보다 풀리는 편이 안전하다.

## 3. 놓은 자리 → 블록: 거리 순 + 24px 스냅

- #62의 `placeOnNearestBlock`은 가장 가까운 블록 하나만 보고, 범위 밖이면 null이다. 높이 31px 문단(17px × 1.85)의 y 허용 폭은 위아래 7.8px(25%)뿐이다. 블록 사이 틈이 22px이라 **틈에 놓으면 대부분 null**이 된다.
- `placeStickerNear`
  1. 크기(size)가 범위 안인 블록만 후보로 둔다.
  2. 각 블록에서 놓은 점을 허용 사각형(x · y −25~125%) 안으로 옮기는 거리(스냅 거리)를 잰다.
  3. (스냅 거리, 블록까지 거리) 순으로 고른다.
  4. 스냅 거리가 `MAX_SNAP_PX`(24px, 블록 사이 틈 22px보다 조금 큼) 이하면 그 자리로 붙이고, 넘으면 null(「여기에는 놓을 수 없어요」)이다.
- "자르지 않는다"(#57)는 커맨드가 받은 값을 조용히 바꾸지 않는다는 규칙이다. 스냅은 손이 놓은 점을 UI가 가장 가까운 허용 자리로 옮기는 것이고, 끄는 동안 유령 이미지가 **스냅된 자리**에 보인다. 그래서 놓은 뒤 결과가 놀랍지 않다. 커맨드는 여전히 범위 밖 값을 거절한다.
- 크기 · 회전 제스처도 같은 이유로 손 위치를 범위 안으로 모은다(크기 5~50%, 회전은 ±180에서 감긴다).

## 4. 키보드

스티커 버튼에 포커스가 있을 때:

| 키                 | 동작                            |
| ------------------ | ------------------------------- |
| ← → ↑ ↓            | x · y ±1%                       |
| `+` `=` / `-`      | 크기 ±1%                        |
| `[` / `]`          | 회전 −15° / +15°(±180에서 감김) |
| Delete · Backspace | 지우기                          |
| Esc                | 고르기 해제, 에디터로 포커스    |

범위 끝에서 더 누르면 커맨드가 false라 아무 일이 없다. 조작 방법은 `aria-describedby` 안내문으로 알린다.

## 5. 패널에서 끌어 오기

- MIME `application/x-blog-editor-sticker`에 스티커 id를 싣는다. `readStickerDrag`는 `STICKER_IDS` 밖이면 null이다.
- `StickerLayer`가 `editor.registerPlugin`으로 `handleDrop` 플러그인을 단다(https://prosemirror.net/docs/ref/#view.EditorProps.handleDrop). 우리 MIME이 있으면 true를 돌려 ProseMirror 기본 삽입을 막는다.
- 놓을 때 스티커 폭은 88px로 잰다. 디자인 69:2의 코랄 별(88px, 600px 블록 ≈ 15%)이다.
- 12개 상한이면 `addSticker`가 false다. 그때 상태 메시지 「스티커는 글 하나에 12개까지예요」를 낸다.
- 격자에 `draggable`을 다는 쪽은 #60 머지 뒤에 한다.
