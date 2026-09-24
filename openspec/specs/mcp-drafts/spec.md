# mcp-drafts Specification

## Purpose

AI(채팅 앱)가 MCP 도구 6개로 블로그 **초안만** 읽고 쓴다(adr-007). 발행 도구는 없고, markdown 입력은 서버가 변환 · 검증하며, 실패 메시지를 AI가 보고 스스로 고친다.

## Requirements

### Requirement: MCP 도구는 초안 읽기 · 쓰기뿐이고 발행 도구가 없다 (보호 대상)

`/mcp`는 SHALL 도구 6개 `get_writing_guide` · `list_posts` · `get_post` · `check_draft` · `create_draft` · `update_draft`만 노출한다. 쓰기 도구는 저장하는 글의 `draft`를 항상 `true`로 두고, 입력에 `draft` 자리가 없다. `update_draft`는 저장된 글이 `draft: true`가 아니면(발행된 글) 고치지 않고 오류를 돌려준다.

#### Scenario: 도구 목록에 발행 도구가 없다

- **WHEN** 유효한 토큰으로 `tools/list`를 부른다
- **THEN** 이름이 정확히 위 6개이고 발행 · 삭제 도구가 없다

#### Scenario: MCP로는 발행된 글을 고치지 못한다

- **WHEN** 발행된 글에 `update_draft`를 부르고, `create_draft`에 `draft: false`를 넣어 부른다
- **THEN** 둘 다 도구 오류이고, 저장된 글과 공개 조회 결과가 바뀌지 않는다

#### Scenario: 발행된 글의 slug로는 새 초안을 만들지 못한다

- **WHEN** 발행된 글과 같은 slug로 `create_draft`를 부른다
- **THEN** 충돌 오류이고 발행 글은 그대로다

### Requirement: create_draft는 markdown을 변환 · 검증해 초안으로 저장하고 출처를 남긴다

`create_draft`는 SHALL `{ slug, title, description, category, markdown }`을 받아 content-convert `convertMarkdown`으로 변환하고, 글 파일 스키마 검증 뒤 `draft: true` · `date`(오늘) · `source: token:<토큰 이름>`으로 새 글을 저장한다. 응답에 `slug` · `revision` · 에디터 링크가 있다. 변환이 실패하면 저장하지 않고 content-convert의 메시지를 그대로 돌려준다. 이미 있는 slug면 저장하지 않고 충돌 오류다.

#### Scenario: 초안이 저장되고 출처가 기록된다

- **WHEN** 올바른 markdown으로 `create_draft`를 부른다
- **THEN** 저장된 글의 `meta.draft`가 `true`, `meta.source`가 `token:<이름>`이고 응답에 `revision`과 에디터 링크가 있다

#### Scenario: markdown이 틀리면 변환 메시지를 그대로 돌려준다

- **WHEN** 지시어 값이 틀린 markdown으로 `create_draft`(또는 `check_draft`)를 부른다
- **THEN** 도구 오류이고 본문에 `convertMarkdown`의 메시지가 그대로 있으며 아무것도 저장되지 않는다

### Requirement: 읽기 도구는 markdown과 revision을 준다

`get_post`는 SHALL 글 하나를 `serializeMarkdown`의 `markdown` · `losses`와 메타 · `revision`으로 돌려준다. `list_posts`는 초안 · 발행 글의 요약(slug · 제목 · 상태 · 날짜)을, `get_writing_guide`는 형식 가이드(content-convert `guide/format.md`)를 돌려준다 — 워크스페이스 글쓰기 가이드를 붙이는 규칙은 "get_writing_guide는 워크스페이스 글쓰기 가이드를 함께 준다"가 정한다.

#### Scenario: get_post는 직렬화 결과와 revision을 준다

- **WHEN** 저장된 글에 `get_post`를 부른다
- **THEN** `markdown`이 `serializeMarkdown(doc).markdown`과 같고 `losses`와 `revision`이 있다

### Requirement: update_draft는 revision이 맞을 때만 쓴다

`update_draft`는 SHALL `{ slug, revision, markdown, … }`을 받아 글 API와 같은 PostStore에 쓴다. 받은 revision이 방금 읽어 초안임을 확인한 판과 다르면 쓰지 않고, 쓸 때는 그 확인한 판을 조건으로 한다 — 확인하지 않은 판(예: 그사이 발행된 글)을 덮지 않는다. 그사이 바뀌었으면 충돌 오류("get_post로 다시 읽어라")다. `date` · `source`는 원래 값을 지킨다.

#### Scenario: 어긋난 revision이면 충돌이다

- **WHEN** 에디터가 글을 먼저 고친 뒤 옛 revision으로 `update_draft`를 부른다
- **THEN** 도구 오류(충돌)이고 저장된 글은 에디터가 쓴 그대로다

#### Scenario: 확인한 판과 다른 revision으로는 발행 글을 덮지 못한다

- **WHEN** 초안을 읽는 사이 그 글이 발행되고, 발행된 판의 revision으로 `update_draft`가 온다
- **THEN** 충돌 오류이고 발행 글은 그대로다

### Requirement: /mcp 요청과 markdown 입력은 크기에 상한이 있다

`/mcp`는 SHALL 연결용 토큰을 확인한 뒤에(인증 → 크기 → 도구 순서) 요청 본문이 1 MiB를 넘으면 413으로 거절하고, 쓰기 · 검사 도구의 `markdown`은 20만 자까지만 받는다. 초안 개수 · 요청 횟수 제한은 M4 스로틀에서 한다.

#### Scenario: 너무 큰 요청 · 너무 긴 markdown은 저장되지 않는다

- **WHEN** 본문이 1 MiB를 넘는 `create_draft`와, markdown이 20만 1자인 `create_draft`를 보낸다
- **THEN** 차례로 413 · 도구 오류이고 아무것도 저장되지 않는다

#### Scenario: 토큰 없는 큰 요청은 크기보다 인증에서 먼저 막힌다

- **WHEN** 토큰 없이 본문이 1 MiB를 넘는 요청을 보낸다
- **THEN** 401이다

### Requirement: 도구 실패는 서버 내부를 드러내지 않는다

도구는 SHALL 충돌이 아닌 이유(저장소 · 파일 오류 등)로 실패하면 AI에게 고정 문구의 도구 오류만 주고, 원래 오류는 서버 로그에 남긴다 — 파일 경로 같은 서버 내부가 응답에 실리지 않는다.

#### Scenario: 저장소 예외의 경로는 응답에 없다

- **WHEN** 저장소가 내부 경로가 담긴 예외를 던지는 상태에서 `list_posts`를 부른다
- **THEN** 도구 오류이고 본문에 그 경로가 없다

### Requirement: get_writing_guide는 워크스페이스 글쓰기 가이드를 함께 준다

`get_writing_guide`는 SHALL 형식 가이드 뒤에 워크스페이스 설정의 글쓰기 가이드를 붙여 돌려준다. 가이드가 비어 있으면 형식 가이드만이다.

#### Scenario: 저장한 가이드가 형식 가이드 뒤에 붙는다

- **WHEN** 설정에 가이드를 저장한 뒤 `get_writing_guide`를 부른다
- **THEN** 응답이 형식 가이드로 시작하고 저장한 가이드를 담는다
