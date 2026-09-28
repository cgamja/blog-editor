## ADDED Requirements

### Requirement: 편집 화면용 AI 수정 되돌리기 API

API는 SHALL 로그인한 세션에 `GET /api/posts/:slug/ai-undo`(선택 `?revision=` — 주면 그 판이 지금 판일 때만)로 지금 되돌릴 수 있는지(`{ available }`)를 주고, `POST /api/posts/:slug/ai-undo`(If-Match 필수)로 MCP `revert_draft`와 같은 규칙으로 되돌린다. If-Match가 지금 revision과 다르면 409, 되돌릴 수 없으면 409가 아닌 실패 응답(이유 포함)이다. 남긴 판은 공개 API에 나가지 않는다.

#### Scenario: 되돌릴 수 있으면 available이고 POST로 되돌린다

- **WHEN** MCP update_draft 뒤 로그인 세션으로 GET · POST(If-Match 지금 revision)를 부른다
- **THEN** GET은 available true이고, POST 뒤 글은 고치기 전 내용이며 GET은 available false다
