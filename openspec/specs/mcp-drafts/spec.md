# mcp-drafts Specification

## Purpose

AI(채팅 앱)가 허용 목록 MCP 도구로 블로그 **초안과 워크스페이스 글쓰기 가이드만** 읽고 쓴다(adr-007 · adr-040). 발행 도구는 없고, markdown 입력은 서버가 변환 · 검증하며, 실패 메시지를 AI가 보고 스스로 고친다.

## Requirements

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

### Requirement: 쓰기 도구 응답에는 SEO 검사 결과가 늘 붙는다

`check_draft` · `create_draft` · `update_draft`는 SHALL 성공 응답에 `seo`와 `seoScore`를 싣는다. `seo`는 `checkSeo`의 발견 목록이고, 비교 대상(`others`)은 자기 글을 뺀 저장된 글들이다. `seoScore`는 그 목록의 `scoreSeo` 점수(0~100)다. AI가 가이드를 잊어도 저장할 때마다 고칠 거리와 점수를 받게 하려는 것이고, 검사 결과로 저장을 막지는 않는다. 비교 대상은 제목이 문자열인 목록 항목만 쓴다. 저장한 뒤 점검이 실패하면 `seo`와 `seoScore`를 `null`로 두고 저장 성공 응답을 그대로 준다.

- `create_draft` · `update_draft`는 `keyword`(핵심 검색어)를 선택 인자로 받아 글 정보에 저장한다. `update_draft`에서 `keyword`를 주지 않으면 원래 값을 지킨다.
- `check_draft`는 `title` · `description` · `keyword`가 함께 오면 그것까지 검사하고, 오지 않은 메타 규칙은 건너뛴다. `seoScore`도 건너뛴 뒤의 목록으로 계산한다. 그래서 메타를 모두 줘야 `create_draft` · `update_draft` 점수와 비교할 수 있다(도구 설명과 형식 가이드에 적는다).

#### Scenario: update_draft 응답의 seoScore

- **WHEN** `update_draft`로 제목만 고치고, 이어서 `edit`로 고친다
- **THEN** 두 응답 모두 `seoScore`가 그 응답 `seo`의 `scoreSeo` 점수다

#### Scenario: 저장 뒤 점검이 실패하면 seo · seoScore 둘 다 null

- **WHEN** 목록 읽기가 실패하는 저장소에서 `create_draft`를 부른다
- **THEN** 저장 성공 응답이고 `seo` · `seoScore`가 둘 다 `null`이다

#### Scenario: create_draft 응답에 seo가 있다

- **WHEN** alt가 빈 이미지가 든 markdown으로 `create_draft`를 부른다
- **THEN** 초안이 저장되고, 응답의 `seo`에 `image-alt` 발견이 있다

#### Scenario: 쓰기 도구 응답에 seo 점수가 있다

- **WHEN** alt가 빈 이미지가 든 markdown으로 `check_draft`와 `create_draft`를 부른다
- **THEN** 두 응답의 `seoScore`는 각각 그 응답 `seo`의 `scoreSeo` 점수이고, 100보다 작다

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

### Requirement: revert_draft는 마지막 AI 저장을 되돌린다

MCP 서버는 SHALL create_draft · update_draft가 저장에 성공할 때 그 글의 저장 전 파일(새 글이면 없음)과 새 revision을 하나 남기고, `revert_draft({ slug })`로 지금 revision이 남긴 revision과 같을 때만 저장 전 파일로 되돌린 뒤 남긴 판을 지운다. 되돌린 결과는 새 revision으로 저장되고 응답에 그 revision이 있다. 발행 글 · 새로 만든 글 · 남긴 판 없음 · 그 뒤 다른 저장이 있으면 도구 오류이고 글은 그대로다.

#### Scenario: 방금 AI 수정을 되돌린다

- **WHEN** update_draft로 문단을 고친 뒤 revert_draft를 부른다
- **THEN** 글이 고치기 전 내용이고 응답에 새 revision이 있으며, 다시 revert_draft를 부르면 되돌릴 판이 없다는 오류다

#### Scenario: AI 저장 뒤 사람이 저장했으면 되돌리지 않는다

- **WHEN** update_draft 뒤 에디터(REST)에서 같은 글을 저장하고 revert_draft를 부른다
- **THEN** 도구 오류이고 글은 사람이 저장한 내용 그대로다

#### Scenario: 새로 만든 글은 되돌릴 판이 없다

- **WHEN** create_draft로 새 글을 만든 뒤 revert_draft를 부른다
- **THEN** 도구 오류이고 글은 그대로다

### Requirement: preview_post는 초안을 공개 렌더 모양으로 찍어 이미지로 준다

MCP 서버는 SHALL `preview_post({ slug, part? })`로 그 글을 공개 렌더와 같은 HTML · CSS로 데스크톱 1280 · 모바일 390 폭에서 찍어 JPEG 이미지 두 장(데스크톱 · 모바일 순)을 돌려준다. 한 장의 긴 변은 1568px 이하이고, 페이지가 그보다 길면 구간으로 나눠 `part`(1부터, 기본 1)번째 구간을 준다. 응답 글에 폭마다 전체 구간 수가 있다. 한 폭의 구간이 이미 끝난 part면 그 폭의 이미지는 빼고 응답 글에 알린다(모바일이 더 길다). 도구는 읽기 전용이고 글을 바꾸지 않는다. 없는 글 · 범위 밖 part는 도구 오류다. 브라우저가 설치돼 있지 않으면 설치 명령을 알리는 도구 오류다.

#### Scenario: 초안을 찍으면 데스크톱 · 모바일 이미지 두 장이 온다

- **WHEN** 문단 · 스티커가 있는 초안으로 `preview_post`를 부른다
- **THEN** 이미지 두 장(image/jpeg)이 오고, 첫 장 폭은 1280 이하 · 둘째 장 폭은 390 이하이며 두 장 모두 긴 변이 1568 이하이고, 글은 그대로다

#### Scenario: 긴 글은 구간으로 나눠 준다

- **WHEN** 한 구간보다 긴 초안으로 `preview_post`를 part 없이, 이어 part 2로 부른다
- **THEN** 응답 글에 전체 구간 수(2 이상)가 있고, part 2도 이미지 두 장이 오며, 전체 구간 수보다 큰 part는 도구 오류다

#### Scenario: 없는 글은 도구 오류다

- **WHEN** 저장소에 없는 slug로 `preview_post`를 부른다
- **THEN** 도구 오류이고 이미지가 없다

#### Scenario: 페이지 높이를 구간으로 나눈다

- **WHEN** 페이지 높이를 구간으로 나눈다
- **THEN** 구간이 위에서부터 빈틈없이 이어지고 한 구간 높이가 1568 이하다

#### Scenario: part로 구간을 고른다

- **WHEN** part(1부터)로 구간을 고른다
- **THEN** 범위 안이면 그 구간이고, 0 · 전체 구간 수보다 크면 없음(null)이다 — 빈 이미지 · 마지막 구간으로 바꾸지 않는다

#### Scenario: 브라우저가 없으면 설치를 안내한다

- **WHEN** 브라우저 실행 파일이 없는 채로 찍는다
- **THEN** 결과는 browserMissing이고, 도구는 `pnpm exec playwright install chromium`을 알리는 도구 오류가 된다

#### Scenario: 자원 요청이 실패해도 서버가 죽지 않는다

- **WHEN** 올린 이미지 저장소 읽기가 실패하는 초안을 찍는다
- **THEN** 그 이미지 없이 데스크톱 · 모바일 두 장을 돌려주고 처리되지 않은 거부가 없다

#### Scenario: 미리보기 문서의 토큰 · 글꼴은 원본과 같다

- **WHEN** 미리보기의 사이트 토큰을 design-tokens `tokens.css`와, 글꼴 주소를 web 화면 글꼴 주소와 대조한다
- **THEN** 이름마다 값이 같고 글꼴 주소가 같다
