# block-controls (이슈 #81)

## Why

사용자 피드백(2026-09-24): "블록들 조절하는 게 부자연스러워. Notion처럼 마우스로 자유자재로 줄어들게 해줘. 이미지도 그렇고."

실브라우저 재현(design.md 1)에서 넷이 나왔다.

1. 끄는 동안 블록은 제자리에 그대로 있고 선만 움직인다. 무엇을 끌고 있는지 보이지 않는다.
2. 편집 화면 틀의 본문(`main.editor-screen-body`)이 스크롤 상자인데, 가장자리까지 끌어도 스크롤되지 않는다. 화면 밖 자리로는 옮길 수 없다.
3. 손잡이를 눌렀다 떼도 아무 일이 없다. Notion은 여기서 블록 메뉴(바꾸기 · 복제 · 지우기)를 연다.
4. 그림 · 앱 스크린샷의 폭은 도구줄의 세 값(50 · 70 · 100)으로만 바꿀 수 있다.

## What Changes

- editor-core
  - `deleteTopBlock(index)`: 최상위 블록을 지운다. 마지막 하나면 빈 문단으로 바꾼다.
  - `atTopBlock(index, command)`: 선택을 그 블록에 둔 상태로 커맨드를 부른다. 블록 메뉴가 커서가 아닌 손잡이 블록에 기존 커맨드(블록 바꾸기 · 감싸기 · 복제)를 쓰게 한다.
  - `TURN_INTO_TARGETS` · `turnTopBlockInto(index, kind)`: 블록 메뉴의 「바꾸기」 항목.
  - `resizedWidthPercent(...)`: 가운데 기준 대칭 폭 계산(순수 함수).
  - `widthPreview()` 플러그인 + `previewBlockWidth(pos, width | null)`: 끄는 동안의 폭 미리보기 노드 장식(문서는 그대로).
- editor-react
  - `autoScrollStep(...)`: 가장자리 거리 → 한 프레임 스크롤 양(순수 함수).
  - 끄는 동안 블록의 반투명 잔상이 포인터를 따라온다. 스크롤 상자 가장자리에서는 자동 스크롤한다. 문서는 놓을 때 한 번만 바뀐다.
  - 손잡이를 끌지 않고 누르면 블록 메뉴(APG menu-button)를 연다.
  - 그림 · 앱 스크린샷을 고르면 좌우 가장자리에 폭 손잡이가 생긴다. 끄는 동안 폭 미리보기와 「가로 N%」를 보이고, 놓을 때 `setBlockWidth`를 한 번 부른다.

## Impact

- editor-core: `commands/block-controls.ts`(새) · `commands/block-controls.constants.ts`(새) · `plugins/width-preview.ts`(새) · `index.ts`
- editor-react: `BlockMoveHandle.tsx` · `BlockMenu.tsx`(새) · `BlockHandles.tsx` · `WidthResizeHandles.tsx`(새) · `use-auto-scroll.ts`(새) · `block-geometry.ts` · `extensions.ts` · `messages.ts` · `BlogEditor.tsx` · `editor.css`
- 스키마와 저장 형식은 바뀌지 않는다.
