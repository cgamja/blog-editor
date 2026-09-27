## ADDED Requirements

### Requirement: 도구는 읽기 전용 여부를 표시한다

`tools/list`의 도구는 SHALL MCP `ToolAnnotations`로 읽기 전용 여부를 표시한다. 글을 바꾸지 않는 읽기 도구 4개(`get_writing_guide` · `list_posts` · `get_post` · `check_draft`)는 `readOnlyHint: true`이고, 초안을 만들거나 고치는 쓰기 도구 2개(`create_draft` · `update_draft`)는 `readOnlyHint: false`다. 클라이언트(Codex `default_tools_approval_mode = "writes"` 등)는 이 표시로 확인 없이 부를 도구를 고른다. 표시는 힌트이고, 초안만 쓰는 불변 조건은 여전히 서버가 지킨다.

#### Scenario: tools/list에서 읽기 도구만 읽기 전용으로 표시된다

- **WHEN** `tools/list`를 부른다
- **THEN** `get_writing_guide` · `list_posts` · `get_post` · `check_draft`는 `annotations.readOnlyHint`가 `true`이고, `create_draft` · `update_draft`는 `true`가 아니다
