# Design — editor-react-mount

## 1. 조립은 순수 함수, 훅은 얇게

TipTap `Editor`는 DOM에 마운트되어야 한다. 그래서 React · DOM 없이 검증할 수 있는 것(확장 목록 · 초기 content · 저장 문서)을 순수 함수로 떼고 Vitest node에서 테스트한다. 훅 `useBlogEditor`는 `useEditor({ extensions: blogEditorExtensions(), content: toEditorContent(doc) })`만 부른다. 근거: https://tiptap.dev/docs/editor/getting-started/install/react (useEditor · EditorContent), 설치된 `@tiptap/react` 3.31.3 타입.

## 2. 초기 문서는 docToNode를 지난다

blockGuard는 "이전 문서가 무효면 꺼진다"(editor-block-guard 스펙). 그래서 무효 문서가 에디터에 들어오면 세션 내내 가드가 없다. `toEditorContent`는 `docToNode(createEditorSchema(), doc).toJSON()`을 돌려주고, 무효면 던진다 — 마운트하는 쪽이 오류를 보여 준다. TipTap이 자기 스키마 인스턴스로 다시 노드를 만들지만 같은 확장에서 나온 같은 모양이다.

## 3. 확장 조립

`editorExtensions`에는 스키마 · StickerSafeSplit · PasteNormalizer가 이미 있다. editor-react가 더하는 것:

- `BlockGuard` — `addProseMirrorPlugins: () => [blockGuard()]`
- `MoveBlock` — editor-core가 export한 확장 그대로
- `CustomBlockKeys` — `Backspace`에 `backspaceAfterCustomBlock`(editor-core가 "키맵 등록은 editor-react"라고 남긴 몫). 코어 Keymap(우선순위 100)보다 먼저 보도록 우선순위를 올린다. 커맨드가 false면 코어 Backspace로 넘어간다.

## 3-1. 다시 만드는 조건은 key뿐

`useEditor(options, deps)`는 deps가 바뀌면 에디터를 새로 만든다(설치된 `@tiptap/react` 3.31.3 타입). 부모가 저장 뒤 새 doc 객체를 넘길 때마다 다시 만들면 커서 · undo가 날아간다. 그래서 초기 content는 `key`가 바뀔 때만 다시 읽고(이전 key를 상태로 두고 렌더 중 비교 — React 공식 패턴), deps는 `[key]`뿐이다. 이 계약은 React 렌더가 필요해 node 테스트가 없다 — DOM 테스트 환경은 adr-019에서 들이지 않기로 했다.

## 4. 상태

adr-006: 문서 상태는 EditorState 하나. 플레이그라운드의 JSON 보기는 `useEditorState({ editor, selector })`로 읽기만 한다. Zustand 없음.

## 5. 플레이그라운드

Vite(`playground/`), `PORT` env 필수 + `strictPort: true`(CLAUDE.md 가정 — 병렬 worktree). 디자인 없음. 본문 CSS는 content-render `post.css`. NodeSelection 외곽선은 editor-react `editor.css`.
