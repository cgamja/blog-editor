# block-controls-review (PR #87 리뷰)

## Why

PR #87 리뷰 2축에서 나온 것.

1. 폭 계산이 늘 가운데 대칭(×2)이다. 왼쪽 · 오른쪽 정렬 그림은 한쪽이 고정이라 손잡이가 포인터보다 두 배 빨리 움직인다.
2. 끄는 블록의 잔상이 `.post-body` 밖이라 본문 CSS가 먹지 않는다. 스티커 · 그림 · 제목 모양이 깨지고, 잔상 안 링크가 Tab 포커스를 받는다.
3. 블록 메뉴를 연 채 손잡이를 끌면 메뉴 상태가 남아 손잡이가 다시 뜨지 않는다.
4. 폭을 끄는 중에 선택이 바뀌면 미리보기 장식이 남고, 놓을 때 엉뚱한 블록에 폭이 들어간다.

## What Changes

- editor-core `resizedWidthPercent`: 입력에 `align`(없으면 가운데)을 받는다. 가운데면 배수 2, 왼쪽 · 오른쪽이면 1.
- editor-react:
  - 잔상 컨테이너는 `post-body` 클래스를 달고 `inert`다.
  - 끌기를 시작하면 블록 메뉴를 닫는다.
  - 폭을 끄는 중 대상이 바뀌거나 사라지면 미리보기를 풀고, 놓을 때 선택이 그 블록일 때만 적용한다.
- 정리: 끌기 훅 분리(`use-block-drag.ts`), 자동 스크롤을 `auto-scroll.ts`로, 메뉴 배치 훅은 스크롤을 호출부에 맡긴다, 블록 메뉴는 열 때 한 번만 계산한다.

## Impact

- editor-core `commands/block-controls.ts` · `block-controls.types.ts`
- editor-react `BlockMoveHandle.tsx` · `use-block-drag.ts`(새) · `BlockDragOverlay.tsx`(새) · `BlockHandles.tsx` · `BlockMenu.tsx` · `BlockAddMenu.tsx` · `use-menu-placement.ts` · `auto-scroll.ts`(새) · `block-geometry.ts` · `WidthResizeHandles.tsx` · `editor.css`
