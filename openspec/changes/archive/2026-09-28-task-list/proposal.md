# task-list (이슈 #132)

## Why

할 일 목록(GFM `- [ ] 할 일` · `- [x] 끝남`)이 지금 닫힌 집합 밖이라 가져오기 · MCP 초안에서 거부되고(`taskListMessage`), 에디터에서는 만들 수 없다. 사용자가 2026-09-25 마크다운 문법 확장 셋(표 #130 · 강제 줄바꿈 #131 · 할 일 목록)을 골랐다. 스키마 모양은 adr-028 3절이 정했다(`listItem.attrs.checked`). 이 change는 공개 HTML 마크업 · 접근성 · 에디터 동작을 정한다(adr-036).

## What Changes

- content-schema: `listItem`에 선택 attrs `checked: boolean`. 값이 없으면 보통 항목이다. 점 · 번호 · 안쪽 목록 어디서나, 한 목록 안에 섞여도 된다.
- content-convert
  - 목록 항목 첫 줄 맨 앞의 `[ ]` · `[x]` · `[X]` + 공백 + 글을 할 일 항목으로 읽는다. markdown-it 플러그인(새 의존성) 대신 우리 core 규칙이 원문(`inline.content`)을 보고 표지를 떼고 항목에 체크 여부를 싣는다. 그래서 `\[ ] 글`처럼 이스케이프한 대괄호는 글자로 남는다.
  - 글이 없는 할 일 항목(`- [ ]`)은 거부한다(고친 예: `- [ ] 할 일`).
  - 직렬화는 `- [ ] ` · `- [x] `로 쓴다. 보통 항목 글의 `[x] `는 대괄호를 늘 이스케이프하므로(`\[x\]`) 할 일로 읽히지 않는다.
  - 형식 가이드와 `update_draft` 부분 고치기(range-edit)가 할 일 항목 글자를 찾고 체크 여부를 지킨다.
- content-render: 할 일 항목은 `<li class="post-task"><p><input type="checkbox" disabled aria-label="완료">글</p></li>`(체크면 `checked`). 읽는 사람이 바꿀 수 없고, 스크린 리더는 "완료, 체크박스, 선택됨/선택 안 됨"으로 읽는다. 본문 CSS가 글머리 기호를 지우고 체크 칸을 글머리 자리에 둔다.
- editor-core
  - `listItem`의 `checked` attr(에디터 HTML `li[data-checked]`, 공개 HTML `li.post-task` + 체크 칸을 읽는다).
  - 커맨드 `toggleTaskItem(pos)` · `wrapInTaskList`. 블록 메뉴 「바꾸기」 · 「+」 · `/` 메뉴에 「할 일 목록」.
  - 입력 규칙: 목록 항목 첫 줄 맨 앞 또는 최상위 문단 맨 앞에서 `[ ] ` · `[x] ` → 할 일 항목(최상위 문단이면 점 목록으로 감싼다).
  - 할 일 항목에서 Enter로 만든 새 항목은 체크하지 않은 할 일이다(나누기는 옛 attrs를 복사한다).
  - 체크 칸은 NodeView · 위젯 없이 CSS(`li[data-checked]::before`)로 그리고, 그 자리를 누르면(mousedown) 체크를 토글한다. 조합(IME) 중에는 바꾸지 않는다.

## Impact

- 새 의존성은 없다. schemaVersion은 1 그대로다(추가뿐, adr-020 · adr-028).
- 대표 픽스처(allBlocks)의 안쪽 목록 두 항목을 할 일로 바꿨다 — 공개 계약 사본 · 렌더 스냅샷 · openapi.json을 절차대로 다시 만들었다. 「+」 · `/` 메뉴 항목이 12개가 된다(editor-slash-menu).
- 사이트 레포 sanitizer가 `li.post-task` · `input[type=checkbox][disabled][checked][aria-label]`을 받아야 공개 글에 체크 칸이 보인다. 표 · `br`과 함께 사이트 레포 후속으로 한다.
- 하지 않는 것: 독자가 체크를 바꾸는 것(공개 HTML은 읽기 전용), 할 일 항목 전용 키보드 단축키, 체크 여부로 목록 정렬.
