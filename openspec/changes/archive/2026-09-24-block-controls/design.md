# block-controls — design

## 1. 재현(전)

allBlocks 픽스처, 1360×860, headless shell. 증거는 `.claude/state/evidence/81-block-controls/before-*`.

- 첫 블록 손잡이를 화면 아래 끝(y 850)까지 끌고 1초 버틴다. 잔상 0개, 선만 보이고, 스크롤 상자(`main.editor-screen-body`)의 `scrollTop`은 0 그대로다.
- 손잡이를 누르고 바로 뗀다. `role="menu"`가 0개다.
- 그림을 노드로 고른다. 폭 도구줄은 뜨지만 좌우 폭 손잡이는 0개다.

## 2. 누르기와 끌기를 가르는 문턱

손잡이 pointerdown은 곧바로 끌기가 아니다. 포인터가 4px 넘게 움직이면 끌기, 그 전에 떼면 클릭(블록 메뉴)이다. Notion도 같은 버튼 하나로 두 일을 한다. 4px는 마우스를 누를 때 생기는 떨림을 넘는 가장 작은 값이다.

## 3. 잔상

잔상은 블록 DOM을 `cloneNode(true)`한 것을 틀(`.blog-editor-frame`) 위 오버레이로 그린다. 반투명이고 포인터를 받지 않는다. ProseMirror DOM은 건드리지 않는다. 끄는 동안 문서는 바뀌지 않고, 놓을 때 `moveTopBlockTo`를 한 번 부른다. 복제에서는 `contenteditable` · `id`를 지워서 포커스와 접근성 트리에 끼지 않게 한다(`aria-hidden`). HTML5 `setDragImage`는 쓰지 않는다. 포인터 캡처 방식(#59)은 그대로다.

## 4. 자동 스크롤

틀에서 위로 올라가며 처음 만나는 스크롤 상자(`overflow-y: auto | scroll`, 없으면 문서)를 쓴다. 포인터가 그 상자의 위아래 가장자리 48px 안에 있으면, 가장자리에 가까울수록 빠르게(한 프레임 최대 16px) `requestAnimationFrame`마다 스크롤한다. 스크롤하면 놓일 자리도 다시 잰다. 거리 → 속도 계산은 순수 함수로 두고 테스트한다.

## 5. 블록 메뉴 — 손잡이 블록에 커맨드

블록 바꾸기(`turnIntoTextblock`) · 감싸기(`wrapIn*`) · 복제(`duplicateTopBlock`)는 모두 **선택**이 든 블록에 작동한다. 손잡이 블록은 커서와 다를 수 있다. 그래서 `atTopBlock(index, command)`는 선택만 그 블록에 둔 상태를 `EditorState.create`로 따로 만들어 커맨드에 넘긴다. 커맨드가 만든 step은 원래 `state.tr`에 옮겨 담아 보낸다(문서가 같아 step이 그대로 맞는다). 그대로 보내지 않는 이유는 TipTap 체인 때문이다. 체인은 `state.tr`로 공유 트랜잭션을 주고, 커맨드가 부른 dispatch는 무시한 채 그 공유 트랜잭션만 적용한다. 실브라우저에서 블록 메뉴 「큰 제목」이 아무 일도 하지 않은 원인이 이것이었다. 되돌리기 한 번에 돌아가고, 커서도 원래 자리로 온다.

선택 자리는 이렇다.

- 글자를 품은 블록이면 첫 글자 자리(`Selection.findFrom`)
- 그림 · 구분선 같은 atom이면 NodeSelection

「바꾸기」 항목은 `can()`(dispatch 없이 부르기)이 false면 비활성이다. 목록 · 콜아웃 안 글자는 최상위가 아니라서 바꾸기가 막힌다(#75 design.md 3).

## 6. 폭 손잡이 — 가운데 기준 대칭

그림 블록은 가운데 정렬이다. 그래서 오른쪽 손잡이를 dx만큼 끌면 폭이 양쪽으로 2dx 늘어난다(왼쪽은 부호 반대). 계산은 `resizedWidthPercent({ startPercent, startX, x, side, containerWidth })`이다. 결과는 반올림하고 WIDTH_RANGE(25–100) 끝에서 멈춘다. UI 입력이라 잘라서 멈추는 것은 허용이고, 저장값은 늘 범위 안이다.

끄는 동안에는 문서를 바꾸지 않는다. 대신 editor-core 플러그인 `widthPreview`가 그 블록에 노드 장식 `class="post-block" style="--w:N"`을 단다. 폭 속성이 없는 그림은 래퍼 없이 `figure`만 그려져서(dom.ts withDecoration) 클래스가 있어야 본문 CSS의 `--w` 규칙이 먹는다(https://prosemirror.net/docs/ref/#view.Decoration^node). 블록 DOM의 style을 직접 고치면 ProseMirror DOMObserver가 속성 변경을 읽어 블록을 다시 그린다. 그래서 스티커 숨김(#76)과 같은 길을 쓴다. 장식 style은 노드 자신의 `--w` 뒤에 붙어 이긴다. 놓을 때 `setBlockWidth`를 한 번 부르고 미리보기를 푼다. 미리보기는 메타만 있는 트랜잭션이라 되돌리기 기록에 남지 않는다. 문서가 바뀌면 플러그인이 스스로 푼다. 키보드는 기존 폭 도구줄이 맡는다.
