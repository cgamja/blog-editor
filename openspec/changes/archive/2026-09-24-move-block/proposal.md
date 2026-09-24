# move-block (이슈 #43)

## Why

M2(plan 07) 에디터 코어의 "블록 옮기기". 글을 다듬을 때 문단 · 이미지 · 콜아웃의 순서를 바꾸는 일이 잦은데, 잘라 붙이기는 꾸미기 attrs(글꼴 · 움직임 · 폭 · 스티커)를 잃거나 붙여넣기 정규화를 거친다. 최상위 블록을 **attrs째** 이웃과 자리를 바꾸는 커맨드가 필요하다. 스티커는 블록 상대 좌표라(adr-008) 블록과 같이 움직이면 값을 바꿀 필요가 없다.

## What Changes

- 새 파일 `apps/editor/editor-core/src/commands/move-block.ts` — ProseMirror 커맨드 `moveBlockUp` · `moveBlockDown`, 단축키 표 `moveBlockKeymap`(`Mod-Shift-ArrowUp` · `Mod-Shift-ArrowDown`), 그 표를 싣는 TipTap 확장 `MoveBlock`
- `index.ts`에 export 줄만 추가

## Impact

- 새 의존성 없음(`@tiptap/pm/state` · `keymap` · `history`는 이미 있는 `@tiptap/pm` 하위 경로)
- 하지 않는 것: `editorExtensions`(extensions.ts)에 `MoveBlock`을 넣는 일 — 에디터를 조립하는 쪽(editor-react)이 고른다. 끌어 놓기(drag handle) · 화면 버튼 · 안쪽 블록(목록 항목) 옮기기
- 실브라우저 확인(단축키가 macOS 선택 확장을 덮는지, 한글 조합 중 단축키)은 editor-react 마운트 뒤 #44 체크리스트로 넘긴다
