## ADDED Requirements

### Requirement: update_writing_guide는 워크스페이스 글쓰기 가이드만 고친다

MCP 서버는 SHALL `update_writing_guide({ guide })`로 워크스페이스 글쓰기 가이드 전체를 받은 글로 바꾸고, 저장된 가이드를 응답 글로 돌려준다. 형식 가이드는 바뀌지 않는다. `get_writing_guide` 응답에서 워크스페이스 가이드는 `## 이 블로그의 글쓰기 가이드` 제목 아래부터 끝까지다 — `guide`에 그 제목 줄이나 형식 가이드 첫 제목 줄이 있으면 실패하고 저장하지 않는다. 가이드가 설정 저장 크기 상한을 넘으면 실패하고 저장하지 않는다. 다음 `get_writing_guide`는 바뀐 가이드를 준다.

#### Scenario: 가이드를 바꾸면 다음 get_writing_guide에 보인다

- **WHEN** 유효한 토큰으로 `update_writing_guide`에 "문단은 세 줄 이내로 쓴다."를 준다
- **THEN** 응답에 그 가이드가 있고, 설정 저장소의 가이드가 그 글이며, `get_writing_guide`가 형식 가이드 뒤에 그 글을 준다

#### Scenario: 크기 상한을 넘으면 저장하지 않는다

- **WHEN** 설정 저장 상한보다 긴 가이드를 준다
- **THEN** 도구 오류이고 설정 저장소의 가이드는 그대로다

#### Scenario: 형식 가이드나 워크스페이스 가이드 제목이 섞이면 저장하지 않는다

- **WHEN** `get_writing_guide` 응답 전체, 또는 `## 이 블로그의 글쓰기 가이드` 제목 줄이 든 글을 `guide`로 준다
- **THEN** 도구 오류("워크스페이스 가이드 부분만 보낸다")이고 설정 저장소의 가이드는 그대로다

## MODIFIED Requirements

### Requirement: MCP 도구는 초안 읽기 · 쓰기뿐이고 발행 도구가 없다 (보호 대상)

`/mcp`는 SHALL 허용 목록(보호 테스트)의 도구 7개 `get_writing_guide` · `list_posts` · `get_post` · `check_draft` · `create_draft` · `update_draft` · `update_writing_guide`만 노출한다(adr-040). 쓰는 것은 초안과 워크스페이스 글쓰기 가이드뿐이고, 발행 · 삭제 도구는 없다. 쓰기 도구는 저장하는 글의 `draft`를 항상 `true`로 두고, 입력에 `draft` 자리가 없다. `update_draft`는 저장된 글이 `draft: true`가 아니면(발행된 글) 고치지 않고 오류를 돌려준다.

#### Scenario: 도구 목록에 발행 도구가 없다

- **WHEN** 유효한 토큰으로 `tools/list`를 부른다
- **THEN** 이름이 정확히 위 7개이고 발행 · 삭제 도구가 없다

#### Scenario: MCP로는 발행된 글을 고치지 못한다

- **WHEN** 발행된 글에 `update_draft`를 부르고, `create_draft`에 `draft: false`를 넣어 부른다
- **THEN** 둘 다 도구 오류이고, 저장된 글과 공개 조회 결과가 바뀌지 않는다

#### Scenario: 발행된 글의 slug로는 새 초안을 만들지 못한다

- **WHEN** 발행된 글과 같은 slug로 `create_draft`를 부른다
- **THEN** 충돌 오류이고 발행 글은 그대로다

### Requirement: update_draft는 전체 · 부분 · 글 정보만 고친다

`update_draft`는 SHALL 다음 셋 중 하나로 초안을 고친다. 초안 고치기는 이 도구 하나다(부분 고치기용 도구를 따로 두지 않는다).

- `markdown`: 글 전체를 바꾼다(지금과 같다).
- `edit` = `{ command: "replace" | "insert_after", selection, markdown }`: `editDocRange`로 범위만 고친다.
- 둘 다 없음: `title` · `description` · `category` · `keyword`만 바꾼다.

`markdown`과 `edit`를 함께 주면 실패한다. 셋 다 없고 글 정보 인자도 없으면 실패한다. 어느 경우든 revision 확인 · 초안 확인 · 초안 유지(`draft: true`) · 응답의 `seo`는 지금과 같다. 범위 실패는 `editDocRange`의 메시지를 도구 오류로 돌려준다.

#### Scenario: 범위 바꾸기로 한 문단 글자만 고친다

- **WHEN** 스티커가 있는 초안에 `edit: { command: "replace", selection, markdown }`로 `update_draft`한다
- **THEN** 그 글자만 바뀌어 저장되고, 스티커 · 다른 블록이 그대로이며, 응답에 새 revision과 `seo`가 있다

#### Scenario: 글 정보만 바꾼다

- **WHEN** `markdown` · `edit` 없이 `title`만 주어 `update_draft`한다
- **THEN** 제목만 바뀌고 문서는 그대로다

#### Scenario: 바꿀 것이 없으면 실패한다

- **WHEN** `markdown` · `edit` · 글 정보 인자 없이 `update_draft`한다
- **THEN** 도구 오류이고 글이 그대로다

#### Scenario: markdown과 edit를 함께 주면 실패한다

- **WHEN** `markdown`과 `edit`를 함께 주어 `update_draft`한다
- **THEN** 도구 오류이고 글이 그대로다

#### Scenario: 발행 글은 부분 고치기도 못 한다

- **WHEN** 발행 글에 `edit`로 `update_draft`한다
- **THEN** 도구 오류이고 발행 글이 그대로다

### Requirement: 도구는 읽기 전용 여부를 표시한다

`tools/list`의 도구는 SHALL MCP `ToolAnnotations`로 읽기 전용 여부를 표시한다. 글을 바꾸지 않는 읽기 도구 4개(`get_writing_guide` · `list_posts` · `get_post` · `check_draft`)는 `readOnlyHint: true`이고, 초안 · 글쓰기 가이드를 만들거나 고치는 쓰기 도구 3개(`create_draft` · `update_draft` · `update_writing_guide`)는 `readOnlyHint: false`다. 클라이언트(Codex `default_tools_approval_mode = "writes"` 등)는 이 표시로 확인 없이 부를 도구를 고른다. 표시는 힌트이고, 초안 · 가이드만 쓰고 발행하지 않는 불변 조건은 여전히 서버가 지킨다.

#### Scenario: tools/list에서 읽기 도구만 읽기 전용으로 표시된다

- **WHEN** `tools/list`를 부른다
- **THEN** `get_writing_guide` · `list_posts` · `get_post` · `check_draft`는 `annotations.readOnlyHint`가 `true`이고, `create_draft` · `update_draft` · `update_writing_guide`는 `true`가 아니다
