## MODIFIED Requirements

### Requirement: 읽기 도구는 markdown과 revision을 준다

`get_post`는 SHALL 글 하나를 `serializeMarkdown`의 `markdown` · `losses`와 메타 · `revision`으로 돌려준다. `list_posts`는 초안 · 발행 글의 요약(slug · 제목 · 상태 · 날짜)을, `get_writing_guide`는 형식 가이드(content-convert `guide/format.md`)를 돌려준다 — 워크스페이스 글쓰기 가이드를 붙이는 규칙은 "get_writing_guide는 워크스페이스 글쓰기 가이드를 함께 준다"가 정한다.

#### Scenario: get_post는 직렬화 결과와 revision을 준다

- **WHEN** 저장된 글에 `get_post`를 부른다
- **THEN** `markdown`이 `serializeMarkdown(doc).markdown`과 같고 `losses`와 `revision`이 있다
