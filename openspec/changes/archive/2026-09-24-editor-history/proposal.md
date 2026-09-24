# editor-history (이슈 #68)

## Why

에디터 확장 목록(adr-017 자체 확장)에 history가 없어서 실브라우저에서 ⌘Z · ⌘⇧Z가 아무 일도 하지 않는다. 커맨드마다 "undo 한 번에 되돌아간다"는 스펙은 테스트가 `history()`를 직접 붙인 상태에서만 확인됐고, 사용자가 쓰는 조립본에는 되돌리기가 없었다(PR #67 작업 중 발견).

## What Changes

- 새 파일 `apps/editor/editor-core/src/plugins/history.ts`: `historyKeymap`(`Mod-z` → undo, `Mod-Shift-z` · `Mod-y` → redo), 그것과 `history()`를 묶은 `historyPlugins()`, 이를 싣는 TipTap 확장 `History`
- editor-react `blogEditorExtensions()`에 `History`를 더한다
- `docs/ime-checklist.md`에 "조합 중 · 직후 ⌘Z" 항목

## Impact

- 새 의존성 없음: `@tiptap/pm/history`(prosemirror-history 1.5.0)는 `@tiptap/pm` 하위 경로
- `editorExtensions`에는 넣지 않는다. 스키마와 무관한 동작이라 MoveBlock처럼 조립하는 쪽이 고른다
- 하지 않는 것: 툴바 되돌리기 버튼(M3 web)
