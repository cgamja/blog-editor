# slash-menu (이슈 #90)

## Why

사용자 결정(2026-09-24, 꾸미기 2차 계획): Notion처럼 `/`로 블록 메뉴를 연다. 블록 옆 「+」 메뉴(#64)는 마우스를 올려야 보여서 키보드만으로는 새 블록을 넣을 길이 없었다. 슬래시 메뉴가 그 키보드 경로다.

## What Changes

- editor-core
  - `slashMenu()` 플러그인 + `slashMenuKey`: `/`를 친 자리와 이어 친 거르기 글자(query)를 상태로 들고 있다. 문서에서 query를 다시 읽으므로 한글 조합 중에도 따라간다.
  - 여는 조건: 최상위 문단에서, 줄 맨 앞이거나 공백 바로 뒤에 `/`를 칠 때. 코드 블록 · 코드 마크 · 목록 · 인용 · 콜아웃 · 제목 안에서는 열리지 않는다.
  - 닫는 조건: Esc, query에 공백, `/`가 지워짐, 커서가 `/` 앞으로 가거나 그 문단을 벗어남. 닫혀도 입력한 글자는 그대로 남는다.
  - `applySlashItem(kind)`: `/거르기`를 지우고, 문단이 비었으면 그 문단을 고른 블록으로 바꾸고(꾸미기는 옮긴다), 글자가 남았으면 아래에 새 블록을 넣는다. 한 트랜잭션이라 undo 한 번에 돌아간다.
  - `closeSlashMenu`: 닫기 커맨드.
  - `SlashMenu` 확장: 방향키 · Enter · Tab을 UI 쪽 처리기(storage.onKey)에 넘긴다. 조합 중 키는 넘기지 않는다.
  - 공용: 다른 상태에서 돈 커맨드의 step을 옮겨 담는 `appendCommandSteps` — `atTopBlock`과 슬래시 메뉴가 함께 쓴다.
- editor-react
  - `filterSlashItems(query)`: 「+」 메뉴와 같은 목록(`INSERTABLE_BLOCKS`)을 한글 이름 · 영문 별칭으로 거른다.
  - `SlashMenu` 컴포넌트: 커서 아래 listbox, 에디터 포커스를 둔 채 `aria-activedescendant`로 고른 항목을 알린다(APG combobox). 일치 항목이 없으면 닫는다.

## Impact

- editor-core: `plugins/slash-menu.ts`(새) · `commands/slash.ts`(새) · `commands/derived-command.ts`(새) · `commands/block-controls.ts` · `index.ts`
- editor-react: `slash-items.ts`(새) · `SlashMenu.tsx`(새) · `messages.ts` · `extensions.ts` · `BlogEditor.tsx` · `editor.css`
- 스키마 · 저장 형식 변화 없음. 새 의존성 없음.
