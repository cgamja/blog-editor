# Design — block-align

## 1. 기본값은 블록 종류마다 다르다

post.css는 `align`이 없을 때 글 블록(문단 · 제목)을 왼쪽 글자로, 폭을 줄인 그림 · 앱 스크린샷을 가운데(`margin-inline: auto`)로 그린다. 그래서 "기본값이면 속성을 지운다"를 블록마다 판정한다 — `width` 자리가 있는 블록(그림 · 스크린샷)은 기본 `center`, 나머지는 `left`(`defaultAlignOf`). 문단에 `left`를 주면 속성이 사라지고, 그림에 `left`를 주면 `align: "left"`가 저장된다. 정규형이 하나로 남는다.

## 2. 커맨드 관례(#62 editor-decoration과 같다)

- 대상은 선택이 걸친 최상위 블록 전부(`selectedTopBlocks`). 하나라도 `align` 자리가 없으면(목록 · 인용 · 콜아웃 · 코드 · 구분선) 전체를 거절 — `canHoldDecoration(node, "align")`.
- 닫힌 집합 밖 값은 자르지 않고 false(`alignOrNull`).
- 모든 대상이 이미 그 모양이면 true이되 dispatch하지 않는다(빈 undo 단계 없음).
- `setNodeAttribute`(AttrStep)라 노드 선택이 유지되고 undo 한 번에 돌아간다.

## 3. 단축키

⌘⇧L · ⌘⇧E · ⌘⇧R(Google Docs · TipTap TextAlign과 같다). 키 이름은 `Mod-Shift-l` 꼴 — prosemirror-keymap은 Shift로 대문자가 된 `L`도 keyCode 기반 이름(`l`)으로 다시 찾는다(1.2.3 `keydownHandler`). 정렬할 수 없는 곳에서도 키를 삼킨다(`swallowing`) — ⌘⇧R은 브라우저 강력 새로 고침이라 편집 중 누르면 글이 사라진 것처럼 보인다. 입력 영역 안에서만 삼키므로 에디터 밖 단축키는 그대로다.

## 4. UI

- 꾸미기 패널: 정렬 필드(왼쪽 · 가운데 · 오른쪽, `aria-pressed` — 현재 모양은 `alignOf`, 저장된 값이 없으면 기본값이 눌림). 못 가지는 블록이면 비활성 + "…에는 정렬을 줄 수 없어요".
- 폭 도구줄(그림 · 스크린샷): 같은 정렬 3버튼을 폭 버튼 뒤에.
- 아이콘은 inline SVG(선 3개), 이름은 `aria-label`.
