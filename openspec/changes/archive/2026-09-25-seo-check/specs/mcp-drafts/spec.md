## ADDED Requirements

### Requirement: 쓰기 도구 응답에는 SEO 검사 결과가 늘 붙는다

`check_draft` · `create_draft` · `update_draft`는 SHALL 성공 응답에 `seo`를 싣는다. `seo`는 `checkSeo`의 발견 목록이고, 비교 대상(`others`)은 자기 글을 뺀 저장된 글들이다. AI가 가이드를 잊어도 저장할 때마다 고칠 거리를 받게 하려는 것이고, 검사 결과로 저장을 막지는 않는다. 비교 대상은 제목이 문자열인 목록 항목만 쓴다. 저장한 뒤 점검이 실패하면 `seo`를 `null`로 두고 저장 성공 응답을 그대로 준다.

- `create_draft` · `update_draft`는 `keyword`(핵심 검색어)를 선택 인자로 받아 글 정보에 저장한다. `update_draft`에서 `keyword`를 주지 않으면 원래 값을 지킨다.
- `check_draft`는 `title` · `description` · `keyword`가 함께 오면 그것까지 검사하고, 오지 않은 메타 규칙은 건너뛴다.

#### Scenario: create_draft 응답에 seo가 있다

- **WHEN** alt가 빈 이미지가 든 markdown으로 `create_draft`를 부른다
- **THEN** 초안이 저장되고, 응답의 `seo`에 `image-alt` 발견이 있다

#### Scenario: 목록에 모양이 어긋난 항목이 있어도 저장 성공이다

- **WHEN** 목록 요약에 제목이 문자열이 아닌 항목이 섞인 저장소에서 `create_draft`를 부른다
- **THEN** 초안이 저장되고 응답이 도구 오류가 아니다

#### Scenario: keyword를 저장하고 update_draft는 없으면 지킨다

- **WHEN** `keyword`를 넣어 `create_draft`한 뒤 `keyword` 없이 `update_draft`한다
- **THEN** 저장된 글의 `meta.keyword`가 처음 값 그대로다

### Requirement: MCP 서버는 연결할 때 쓰는 순서를 알린다

`/mcp` 서버는 SHALL 초기화 응답의 `instructions`에 다음을 담는다.

- 쓰기 전에 `get_writing_guide`를 읽는다
- 쓰기 도구 응답의 `seo` 발견(must부터)을 고친다
- 발행은 사람이 에디터에서 한다

#### Scenario: 초기화 응답에 instructions가 있다

- **WHEN** 유효한 토큰으로 `initialize`를 부른다
- **THEN** 응답 `instructions`에 `get_writing_guide`와 `seo`가 들어 있다
