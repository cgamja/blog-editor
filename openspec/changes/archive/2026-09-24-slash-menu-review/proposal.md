# slash-menu-review (이슈 #90 · PR #91 리뷰)

## Why

PR #91 리뷰 2축에서 나온 것. `/큰제목`처럼 띄어 쓰지 않은 이름이 맞지 않고, Shift+Enter 같은 수정키 조합까지 메뉴가 가져가며, 적용 직후 친 글자가 적용과 한 묶음으로 되돌아간다.

## What Changes

- 거르기: 이름의 공백 · `·`을 빼고 비교한다.
- 키: 수정키가 눌린 키는 넘기지 않는다.
- 적용: 이어지는 커맨드를 먼저 확인하고(거절이면 아무것도 지우지 않는다), 적용 앞뒤로 되돌리기 묶음을 끊는다.
- 정리: 공개 타입 파일 분리, 키맵 우선순위 한 곳, 슬래시 메뉴 z-index 층, 컴포넌트 훅 분리, `appendCommandSteps` 반환값을 결과 이름으로.

## Impact

- editor-core: `plugins/slash-menu.ts` · `plugins/slash-menu.types.ts`(새) · `keymap-priority.constants.ts`(새) · `commands/slash.ts` · `commands/derived-command.ts` · 키맵 우선순위를 쓰는 파일들
- editor-react: `slash-items.ts` · `slash-menu.constants.ts`(새) · `SlashMenu.tsx` · `use-slash-menu-*.ts`(새) · `editor.css`
