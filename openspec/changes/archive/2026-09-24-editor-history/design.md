# Design — editor-history

## 1. prosemirror-history를 그대로 쓴다

TipTap v3의 UndoRedo 확장은 `@tiptap/extensions` 패키지에 있고 editor-core는 그 패키지에 의존하지 않는다(adr-017은 스키마 확장을 직접 쓰기로 했다). `@tiptap/pm/history`의 `history()` · `undo` · `redo`는 이미 테스트가 쓰고 있는 같은 구현이라, 새 의존성 없이 확장 하나로 싣는다. https://prosemirror.net/docs/ref/#history

## 2. 한글 조합

prosemirror-history는 트랜잭션의 `composition` 메타가 이전과 같으면 새 그룹을 만들지 않는다(1.5.0 `applyTransaction`, CHANGELOG "composition … split across multiple undo events" 수정). 그래서 조합 한 번은 undo 한 번으로 되돌아가야 한다. 조합 중 ⌘Z는 브라우저 · IME가 먼저 가로챌 수 있어 실브라우저 확인은 #44 체크리스트로 넘긴다.

## 3. 단축키

`Mod-z` undo, `Mod-Shift-z` · `Mod-y` redo — ProseMirror 예제 설정(prosemirror-example-setup buildKeymap)과 같은 조합. 우선순위는 기본값으로 둔다. 같은 키를 쓰는 확장이 없다.
