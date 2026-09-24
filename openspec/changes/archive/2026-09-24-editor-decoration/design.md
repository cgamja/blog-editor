# Design — editor-decoration

## 1. 대상 블록 = 선택이 걸친 최상위 블록

- 꾸미기 자리는 최상위 블록에만 있다(adr-008). ProseMirror 스키마는 안쪽 노드에도 같은 attrs 키를 두지만(TipTap 확장 공유) zod가 거부한다. 그래서 커맨드는 늘 **최상위** 블록을 고친다. 목록 안 커서면 바깥 목록이 대상이다.
- 선택이 걸친 최상위 블록 전부에 같은 값을 넣는다. 하나라도 그 속성을 못 가지면(코드 블록에 `font` 등) 전체를 `false`로 거절한다. 일부만 바뀌면 사용자가 무엇이 바뀌었는지 알 수 없다.
- 최상위 노드 선택의 끝은 깊이 0이라 다음 블록 index를 가리킨다. 그 블록은 빼고 센다.
- GapCursor(깊이 0 빈 선택)와 AllSelection은 `false`다. 기존 커스텀 블록 · 감싸기 커맨드와 같다.
- 속성은 `tr.setNodeAttribute`(AttrStep)로 바꾼다. 위치를 움직이지 않아 노드 선택이 그대로 남는다(https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute). `null`은 "없음"이다(zod 쪽 생략).

## 2. 스티커는 블록 위치 + 순번으로 가리킨다

- 스티커에는 id가 없다(스키마). 그래서 `(블록 시작 위치, stickers 배열 index)`로 가리킨다. 블록 시작 위치가 최상위 블록 경계가 아니면 `false`다.
- `addSticker(id, placement?)`
  - `placement` 없음: 커서가 있는 최상위 블록에 기본 좌표 `{ x: 95, y: 5, size: 15, rotate: 0 }`. 디자인 `69:2`의 코랄 별(블록 오른쪽 위 모서리, 약 88px / 600px)과 같은 자리다
  - `placement` 있음: `{ blockPos, x, y, size, rotate }`
  - 글 전체가 이미 `MAX_STICKERS_PER_DOC`개면 `false`
- `updateSticker`는 `x` · `y` · `size` · `rotate` 일부를 바꾼다. `id`는 바꾸지 않는다(지우고 새로 넣는다).
- `removeSticker`로 마지막 스티커를 지우면 `stickers`를 `null`로 둔다. 빈 배열은 정규형에서 지워지는 값이다.
- `moveStickerToBlock(fromPos, index, { blockPos, x, y, size })`는 원래 블록에서 빼고 대상 블록 **끝**에 넣는다. 회전은 유지한다. 같은 블록이면 제자리에서 좌표만 바꾼다. 개수가 그대로라 상한에 걸리지 않는다. 한 트랜잭션이다.
- 값이 닫힌 집합 밖(모르는 id, 정수 아님, 범위 밖)이면 자르지 않고 `false`다. 잘라 넣으면 사용자가 놓은 자리와 다른 곳에 붙는다.

## 3. 좌표 정의는 content-render post.css를 따른다

`.post-sticker`는 `left: x%` · `top: y%` · `width: s%` · `translate(-50%, -50%) rotate(r deg)`다. 따라서

- `x` · `y` = 스티커 **중심**의 위치, 블록 폭 · 높이 기준 %
- `size` = 스티커 폭, 블록 **폭** 기준 %

`placeOnNearestBlock(blocks, point, stickerWidth)`:

- `blocks`: `{ pos, left, top, width, height }[]`(px, 같은 좌표계) · `point`: 놓은 스티커 중심(px) · `stickerWidth`: 스티커 폭(px)
- 점에서 사각형까지 거리(안이면 0)가 가장 작은 블록. 같으면 앞 블록. 폭 · 높이가 0 이하인 사각형은 뺀다
- `x = (px − left) / width × 100`, `y = (py − top) / height × 100`, `size = stickerWidth / width × 100`, 모두 반올림 정수
- 어느 값이든 `STICKER_RANGES` 밖이면 `null`(놓을 수 없는 자리). 빈 목록도 `null`

DOM 측정(`getBoundingClientRect`)은 UI(#61)가 하고, 이 함수는 숫자만 본다.
