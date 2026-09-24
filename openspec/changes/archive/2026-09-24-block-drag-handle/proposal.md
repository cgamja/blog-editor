# block-drag-handle (이슈 #59)

## Why

디자인 `68:2`의 블록 손잡이. 지금은 블록을 키보드(`Mod-Shift-Arrow`, #43)로만 옮길 수 있고, 한 번에 한 칸이다. 먼 자리로 옮기려면 여러 번 눌러야 하고, 마우스로 글을 다듬는 사람은 단축키를 모른다. 손잡이를 끌어 원하는 블록 사이에 바로 놓는다.

## What Changes

- editor-core `commands/drag-block.ts`(새 파일)
  - `moveTopBlockTo(from, gap)`: 최상위 `from`번째 블록을 gap(0 = 맨 앞 … childCount = 맨 끝) 자리로 옮기는 커맨드. 노드를 통째로 옮기니 attrs · 스티커가 따라간다. 한 트랜잭션이다.
  - `blockIndexAt` · `dropGapAt`: 블록 세로 범위(숫자)와 포인터 y만 받는 순수 함수. DOM 없이 테스트한다.
- editor-react `BlockHandle`: 마우스를 올린 최상위 블록 왼쪽의 「블록 옮기기」 버튼(44px). 포인터로 끌면 놓일 자리에 선이 보이고, 놓으면 `moveTopBlockTo`를 부른다. Esc를 누르면 취소한다.
- `BlogEditor`가 편집 영역과 손잡이를 감싸는 틀(position: relative)을 그린다.
- 플레이그라운드 종이의 왼쪽 여백을 디자인 값(80px)으로 맞춘다. 손잡이 자리다.

## Impact

- 새 의존성 없음
- 하지 않는 것
  - 「추가」 버튼: 동작이 디자인 결정 대기 중이다. 자리(-104px)만 비워 둔다.
  - 여러 블록 한꺼번에 끌기, 중첩 블록(목록 항목 · 콜아웃 안) 끌기
  - HTML5 드래그 앤 드롭(ProseMirror 기본 drop 경로)
