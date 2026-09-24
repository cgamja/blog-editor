# editor-history Specification

## Purpose

에디터에서 되돌리기 · 다시 하기(⌘Z · ⌘⇧Z · ⌘Y)를 prosemirror-history로 싣는다. 커맨드 하나는 undo 한 번에 되돌아가고, 한글 조합 한 번은 한 단계로 묶인다(이슈 #68).

## Requirements

### Requirement: 에디터에서 되돌리기 · 다시 하기가 된다

editor-core는 SHALL `historyPlugins()`와 `History` 확장을 export하고, 그 단축키는 `Mod-z`가 undo, `Mod-Shift-z` · `Mod-y`가 redo다. 이 플러그인을 단 상태에서 커맨드 하나(콜아웃 넣기 · 블록 옮기기)는 undo 한 번에 되돌아간다.

#### Scenario: 단축키 표

- **WHEN** `historyKeymap`을 본다
- **THEN** `Mod-z`는 undo, `Mod-Shift-z` · `Mod-y`는 redo다

#### Scenario: 콜아웃 넣기를 undo 한 번에 되돌린다

- **WHEN** `historyPlugins()`와 blockGuard를 단 상태에서 콜아웃을 넣고 undo를 한 번 부른다
- **THEN** 넣기 전 문서와 같다

#### Scenario: 블록 옮기기를 undo 한 번에 되돌린다

- **WHEN** `historyPlugins()`와 blockGuard를 단 상태에서 블록을 위로 옮기고 undo를 한 번 부른다
- **THEN** 옮기기 전 문서와 같다
