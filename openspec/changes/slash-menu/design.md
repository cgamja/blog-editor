# slash-menu — design

## 1. 상태는 문서에서 다시 읽는다

플러그인 상태는 `{ from, query }` 또는 `null`이다. `from`은 `/`의 위치다. 트랜잭션마다 `from`을 매핑하고, 새 문서에서 `from` 자리 글자가 여전히 `/`인지, 커서가 같은 문단에서 `/` 뒤에 있는지 확인한 다음 `query = textBetween(from + 1, 커서)`로 다시 읽는다.

키 입력(handleTextInput)으로 query를 쌓지 않는 이유는 한글 조합이다. prosemirror-view는 조합 중에도 DOM 변경을 읽어 문서를 바꾸는 트랜잭션을 보내지만(DOMObserver), 그 글자는 handleTextInput을 거치지 않는다(https://prosemirror.net/docs/ref/#view.EditorProps.handleTextInput — "composition 입력에는 불리지 않는다"). 문서에서 다시 읽으면 `/제` → `/제목`처럼 조합 중인 글자도 query에 들어간다.

## 2. 여는 자리

`/` 자체는 handleTextInput에서 본다. `/`는 한글 자판에서도 조합 없이 바로 들어간다. 조건이 맞으면 `/`를 넣는 트랜잭션에 여는 meta를 단다. 조건:

- 선택이 비어 있고, 커서가 최상위 문단(깊이 1) 안이다. 목록 · 인용 · 콜아웃 · 제목 · 코드 블록 안은 제외한다. 블록 바꾸기 · 넣기 커맨드가 최상위 블록 기준이다(editor-markdown-shortcuts design.md 3).
- 커서 앞이 줄 맨 앞이거나 공백이다. `a/b` 같은 경로 · 분수는 메뉴를 열지 않는다.
- 저장된 마크(storedMarks) 또는 커서 자리 마크에 코드 마크가 없다.

## 3. 닫는 조건

- Esc(플러그인이 직접 처리한다).
- query에 공백이 들어간다. 줄바꿈도 같다.
- query가 20자를 넘는다. 별칭 중 가장 긴 것보다 넉넉히 길다.
- `/`가 지워지거나(매핑이 deleted), 커서가 `/` 앞으로 가거나, 다른 블록으로 가거나, 범위 선택이 된다.
- UI가 일치 항목이 없다고 판단할 때(closeSlashMenu).

어느 경우에도 입력한 글자는 남긴다.

## 4. 고르기

`applySlashItem(kind)`는 한 트랜잭션이다.

1. `from`부터 커서까지(`/거르기`)를 지운다.
2. 그 문단이 비었으면 문단 자리를 고른 블록으로 바꾼다. 제목 · 목록 · 인용은 `turnIntoTextblock` · `wrapIn*`, 콜아웃 · 구분선은 `replaceEmptyTopParagraph`(새 블록에 문단의 꾸미기를 옮긴다 — `carriedAttrs`). 「문단」은 지우기만 한다.
3. 글자가 남았으면 그 아래에 `insertBlockAfter`로 넣는다. 「+」 메뉴와 같은 동작이다.

2 · 3의 커맨드는 1을 적용한 상태에서 돌리고, 그 step을 1의 트랜잭션에 옮겨 담는다(`appendCommandSteps`). 따로 dispatch하지 않는 이유는 TipTap 체인 때문이다. 체인은 `state.tr`을 공유 트랜잭션으로 주고 커맨드가 부른 dispatch는 무시한다(block-controls design.md 5에서 같은 원인을 찾았다). 같은 옮겨 담기를 `atTopBlock`이 이미 하고 있어서 공용 함수로 뺐다.

## 5. 키보드와 접근성

에디터에 포커스를 둔 채 메뉴를 쓴다(APG combobox — https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). contenteditable에 `aria-controls` · `aria-activedescendant`를 달고, 목록은 `role="listbox"` · `role="option"`이다.

- ↑ ↓: 고른 항목을 옮긴다(끝에서 돌아간다).
- Enter · Tab: 고른 항목을 적용한다.
- Esc: 닫는다.

방향키 · Enter · Tab은 플러그인 handleKeyDown이 `SlashMenu` 확장의 storage 처리기(React가 연결)에 넘긴다. 처리기가 없거나 false면 평소 키 동작이다. 조합 중이면(`view.composing` 또는 `event.isComposing`) 넘기지 않는다 — 조합 중 Enter는 조합 확정만 해야 한다. prosemirror-view 1.42.5는 조합 중 keydown을 플러그인에 넘기기 전에 버리기도 하지만(editHandlers.keydown → inOrNearComposition), 브라우저마다 다른 이벤트 순서를 대비해 여기서도 한 번 더 막는다.

## 6. 목록 한 곳

항목은 「+」 메뉴와 같은 `INSERTABLE_BLOCKS` · `INSERTABLE_BLOCK_LABELS`다. 슬래시 메뉴만의 것은 영문 별칭(`SLASH_ALIASES`, messages.ts)뿐이다. 이미지 넣기(P9)가 머지되면 목록에 더한다.

## 7. 자리

`coordsAtPos(from)` 아래 8px에 띄운다. 선택 팝업 간격 공용 상수(`SELECTION_POPUP_GAP_PX`)는 #89가 들여오는 중이라 아직 main에 없다 — 지금은 파일 상수로 두고, #89가 머지되면 그 상수로 바꾼다(PR에 적는다).
