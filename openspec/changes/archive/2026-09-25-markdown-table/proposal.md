# markdown-table (이슈 #130)

## Why

마크다운 표(GFM `| a | b |`)는 지금 닫힌 집합 밖이다. 가져오기 · MCP 초안에서 "표는 정의 밖이다"로 거부되고, 에디터에서는 만들 수 없다. 사용자가 2026-09-25 실사용 중에 표를 쓰고 싶다고 했다. 마크다운 문법 확장 셋(표 · 강제 줄바꿈 #131 · 할 일 목록 #132) 중 첫째다. 셋의 스키마 모양은 adr-028이 한 번에 정한다.

## What Changes

- content-schema: 최상위 블록 `table` → `tableRow` → `tableCell` → 안쪽 문단 하나. 첫 행이 머리 행이다. 행마다 칸 수가 같다. 열 정렬(`center` · `right`)은 머리 행 칸에만 둔다. 표 꾸미기는 `font` · `motion` · `stickers`
- content-convert: GFM 표 → `table`, `table` → GFM 표(칸 안 `|`는 `\|`). 표 안 그림 · 인용/목록/콜아웃 안 표는 메시지로 거부한다. `{font= motion=}` 지시어를 표에도 쓴다. 형식 가이드에 표를 옮긴다
- content-render: `<div class="post-table-scroll"><table><thead><tr><th scope="col">…` · 본문 `<td>`, 정렬은 `data-align`. post.css: 선 · 머리 행 바탕 · 가로 스크롤
- editor-core: 표 노드 넷(`@tiptap/pm/tables`의 `tableRole`) · `tableEditing` 플러그인 · Tab/Shift+Tab 칸 이동(마지막 칸 Tab은 행 추가) · 행 · 열 더하기/지우기 커맨드 · 열 정렬(⌘⇧L/E/R) · 저장 경계에서 `colspan` · `rowspan` 지우기 · 넣을 수 있는 블록에 `table`(2열 × 2행)
- editor-react: 「+」 · `/` 메뉴에 「표」, 블록 메뉴에 표 항목(아래에 행 · 오른쪽에 열 · 행 지우기 · 열 지우기), 에디터 안 표 모양(첫 행 머리, 정렬 표시)
- adr-028

## Impact

- 새 의존성 없음 — `@tiptap/pm/tables`는 `@tiptap/pm`이 이미 다시 내보낸다(lockfile 그대로)
- schemaVersion 1 그대로(추가뿐)
- 사이트 레포 sanitizer가 `table` · `thead` · `tbody` · `tr` · `th[scope]` · `td` · `div.post-table-scroll` · `data-align`을 받아야 공개 글에 표가 보인다(사이트 레포 후속)
- 하지 않는 것: 칸 병합 · 칸 안 목록 · 그림 · 칸 안 줄바꿈 · 표 칸 색 · 열 폭 조절 · 머리 행 끄기 · 표 위에 행 더하기(첫 행이 머리 행이라 행은 아래로만 더한다) · 셀 여러 개 붙여넣기 모양 고치기
