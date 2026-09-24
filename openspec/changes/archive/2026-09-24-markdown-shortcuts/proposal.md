# markdown-shortcuts (이슈 #70)

## Why

사용자 요청(2026-09-24): Notion처럼 쓰고 싶다. 지금 에디터에는 타이핑 자동 서식(입력 규칙)이 하나도 없고, 서식 단축키도 되돌리기 · 블록 옮기기뿐이다. 계획: https://claude.ai/artifact/JYT1rG4kWVRfdbMefm4pbe (P1). 기준은 Notion 공식 단축키 문서(https://www.notion.com/help/keyboard-shortcuts)이고, 우리 스키마에 없는 블록(할 일 · 토글)은 뺀다.

## What Changes

- 새 파일 `editor-core/src/plugins/markdown-shortcuts.ts`: 입력 규칙과 서식 · 블록 바꾸기 단축키, 이를 싣는 TipTap 확장 `MarkdownShortcuts`
  - 줄 맨 앞: `# `·`## ` → 큰 제목, `### ` → 작은 제목, `- `·`* `·`+ ` → 점 목록, `1. ` → 번호 목록, `" `·`> ` → 인용, ` ``` ` → 코드 블록, `---` → 구분선
  - 인라인: `**굵게**`, `*기울임*`, `` `코드` ``
  - 단축키: ⌘B · ⌘I · ⌘E, ⌘⌥0 문단 · ⌘⌥1/2 큰 제목 · ⌘⌥3 작은 제목 · ⌘⌥5 점 목록 · ⌘⌥6 번호 목록 · ⌘⌥8 코드 블록, ⌘D 블록 복제, 규칙 직후 Backspace는 입력한 글자로 되돌리기
- 새 파일 `editor-core/src/commands/turn-into.ts`: 꾸미기를 들고 가는 블록 바꾸기 · 블록 복제
- 새 파일 `editor-core/src/commands/link.ts`: 허용 목록(hrefSchema)으로 거르는 링크 넣기 · 빼기
- editor-react: `blogEditorExtensions()`에 `MarkdownShortcuts`, ⌘K 링크 입력 팝오버(`LinkPopover`)
- `docs/ime-checklist.md`에 한글 조합 중 규칙 항목

## Impact

- 새 의존성 없음: `@tiptap/pm/inputrules` · `@tiptap/pm/commands` · `@tiptap/pm/keymap`은 `@tiptap/pm` 하위 경로
- 하지 않는 것: 취소선 · 밑줄(스키마에 마크가 없다 — 2단계 P4), `/` 슬래시 메뉴(별도 이슈), 할 일 · 토글(스키마에 없음), 인용 · 콜아웃 · 목록 안에서의 블록 규칙(최상위 블록에서만 — design.md 3)
