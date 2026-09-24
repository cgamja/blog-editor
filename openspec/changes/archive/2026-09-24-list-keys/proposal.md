# list-keys (이슈 #78)

## Why

점 · 번호 목록 항목에서 Enter를 눌러도 새 항목이 생기지 않는다(PR #75 작업 중 발견). 목록 노드는 자체 확장(adr-017)이라 TipTap ListItem이 주던 키맵이 없고, 코어 Enter(splitBlock)는 `paragraph (bulletList | orderedList)*`인 목록 항목 안에서 문단을 둘로 나눌 수 없다. 목록은 글쓰기의 기본 동작이라 먼저 고친다.

## What Changes

- 새 파일 `apps/editor/editor-core/src/plugins/list-keymap.ts`
  - `listKeymap`: Enter(항목 나누기, 빈 항목이면 한 단계 내어쓰기 — 최상위면 목록 빠져나오기) · Tab(들여쓰기) · Shift-Tab(내어쓰기) · Backspace(항목 맨 앞이면 내어쓰기)
  - `liftListItemKeepingDecoration`: 최상위 목록에서 항목을 빼낼 때 꾸미기가 복제되거나 사라지지 않게 한다
  - `ListKeys` 확장(등록만)
- editor-react `blogEditorExtensions()`에 `ListKeys`를 더한다
- `docs/ime-checklist.md`에 "조합 중 목록 Enter" 항목

## Impact

- 새 의존성 없음: `@tiptap/pm/schema-list`(prosemirror-schema-list 1.5.1)는 `@tiptap/pm` 하위 경로
- 하지 않는 것: 할 일 목록 · 토글(스키마에 없음), 여러 항목 드래그
