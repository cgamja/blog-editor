## ADDED Requirements

### Requirement: 에디터 확장은 한 목록으로 조립된다

`@blog-editor/editor-react`는 SHALL `blogEditorExtensions()`를 export하고, 그 목록은 editor-core의 `editorExtensions` 전부에 blockGuard 플러그인 · 블록 옮기기 · 커스텀 블록 Backspace 키맵을 더한 것이다. 이 목록으로 만든 스키마는 editor-core `createEditorSchema()`와 노드 · 마크가 같다.

#### Scenario: 조립한 목록에 가드 · 옮기기 · 키맵이 들어 있다

- **WHEN** `blogEditorExtensions()`의 확장 이름을 본다
- **THEN** `editorExtensions`의 이름 전부와 `blockGuard` · `moveBlock` · `customBlockKeys`가 있다

#### Scenario: 조립한 목록의 스키마는 editor-core 스키마와 같다

- **WHEN** `blogEditorExtensions()`로 스키마를 만든다
- **THEN** 노드 이름 · 마크 이름이 `createEditorSchema()`와 같다

### Requirement: 초기 문서는 경계 함수를 지나야 에디터에 들어간다

`toEditorContent(doc)`는 SHALL `docToNode`를 지난 JSON을 돌려주고, 닫힌 집합을 어기는 문서면 던진다. `readDoc(node)`는 `docFromNode` 결과를 돌려준다.

#### Scenario: 유효한 픽스처는 그대로 에디터 content가 된다

- **WHEN** content-schema 픽스처 셋(minimal · allBlocks · decorationMax)의 doc으로 `toEditorContent`를 부르고 그 결과로 만든 노드를 `readDoc`에 넣는다
- **THEN** 원래 doc과 같다

#### Scenario: 무효 문서는 에디터에 들어가지 않는다

- **WHEN** 인용 안 문단에 font가 붙은 문서로 `toEditorContent`를 부른다
- **THEN** 던진다

### Requirement: 에디터는 key가 바뀔 때만 다시 만든다

`useBlogEditor({ doc, key, label })`는 SHALL 초기 문서를 마운트 때 한 번만 읽고, `key`가 바뀔 때만 에디터를 새로 만든다. 같은 `key`에 새 `doc` 객체를 넘겨도 에디터 인스턴스와 편집 상태(커서 · undo)는 그대로다. `label`은 편집 영역(contenteditable)의 접근성 이름이 된다. 이 동작은 React 렌더가 필요해 node 테스트 대상이 아니다 — 플레이그라운드 실브라우저 확인과 #44 체크리스트로 본다.

#### Scenario: 편집 영역이 label로 불린다 (실브라우저 확인)

- **WHEN** 플레이그라운드가 `label: "본문"`으로 에디터를 마운트한다
- **THEN** contenteditable 요소(`.ProseMirror`)의 `aria-label`이 "본문"이고, 바깥 래퍼에는 aria-label이 없다

#### Scenario: 같은 key에 새 doc을 넘겨도 편집 상태가 남는다 (#44 체크리스트)

- **WHEN** 같은 `key`로 새 `doc` 객체가 넘어온다
- **THEN** 에디터를 다시 만들지 않아 커서 · undo가 그대로다

실패 의미론: 해당 없음 — 순수 조립(서버 상태 없음). 마운트 · 조합 입력은 실브라우저(#44 체크리스트) 몫이다.
