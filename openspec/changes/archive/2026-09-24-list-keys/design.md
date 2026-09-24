# Design — list-keys

## 1. 커맨드는 prosemirror-schema-list

`splitListItem` · `liftListItem` · `sinkListItem`(https://prosemirror.net/docs/ref/#schema-list)을 쓴다. 우리 `listItem`은 `paragraph (bulletList | orderedList)*`라 라이브러리가 전제하는 모양과 같다.

## 2. Enter

- 항목 문단이 비어 있으면 내어쓰기(`liftListItem`) — 안쪽 목록이면 바깥 목록으로, 최상위면 목록을 빠져나와 문단이 된다. Notion · Google Docs와 같다. 라이브러리 `splitListItem`은 빈 항목이 가운데 있으면 빈 항목을 하나 더 만들어서, 빈 항목은 위치와 상관없이 내어쓰기로 보낸다.
- 아니면 `splitListItem`.
- 목록 항목 밖이면 false — 다음 Enter(StickerSafeSplit · 코어)로 넘어간다.

## 3. Tab · Shift-Tab

- 목록 항목 안이면 들여쓰기 · 내어쓰기를 하고, 못 해도(첫 항목 들여쓰기 등) 키를 삼킨다 — 목록을 쓰다가 포커스가 에디터 밖으로 튀지 않게.
- 목록 밖이면 false — 브라우저 기본(포커스 이동)을 막지 않는다(접근성).

## 4. Backspace

항목 문단 맨 앞(빈 선택, parentOffset 0)이면 내어쓰기. 그 밖은 false. 입력 규칙 되돌리기(우선순위 1100)가 먼저 본다 — `- ` 직후 Backspace는 규칙 되돌리기가 이긴다.

## 5. 꾸미기 — 최상위 목록에서 항목을 빼낼 때

꾸미기(font · motion · stickers)는 최상위 블록에만 있다(adr-008). `liftListItem`이 최상위 목록 가운데 항목을 빼내면 목록이 둘로 갈리며 두 조각이 같은 attrs를 가진다 — 스티커가 복제된다. 목록 전체가 빠져나오면 목록 노드가 사라져 꾸미기가 없어진다.

- 스티커 수가 늘었으면: 원래 스티커와 같은 스티커를 가진 뒤쪽 최상위 블록에서 스티커를 지운다(첫 조각에만 남는다 — splitBlockKeepingStickers와 같은 규칙).
- 스티커 수가 줄었으면(목록이 사라짐): 원래 목록의 꾸미기를 빠져나온 첫 최상위 블록에 옮긴다(그 타입이 자리를 가진 것만).
- 한 트랜잭션이라 undo 한 번에 되돌아간다.

## 6. 우선순위와 조합

- `ListKeys` 우선순위 1050: 입력 규칙 되돌리기(1100)보다 뒤, 커스텀 블록 Backspace · StickerSafeSplit(1000)과 코어 Keymap(100)보다 앞.
- 한글 조합 중 keydown은 prosemirror-view가 키맵(handleKeyDown)에 넘기기 전에 버린다(1.42.5 `editHandlers.keydown` → `inOrNearComposition`). 조합 중 Enter는 조합 확정만 하고, 실브라우저 확인은 #44 체크리스트.
