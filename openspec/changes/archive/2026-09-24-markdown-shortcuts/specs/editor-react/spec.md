## ADDED Requirements

### Requirement: 조립한 에디터에 Notion식 입력 규칙이 있다

`blogEditorExtensions()`는 SHALL editor-core `MarkdownShortcuts`를 싣는다. 편집 영역에서 ⌘K는 링크 주소 입력 팝오버를 열고, 허용 목록 밖 주소는 팝오버 안에 이유를 보여 준다(`window.prompt`를 쓰지 않는다).

#### Scenario: 조립한 목록에 입력 규칙이 있다

- **WHEN** `blogEditorExtensions()`의 확장 이름을 본다
- **THEN** `markdownShortcuts`가 있다
