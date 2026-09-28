## ADDED Requirements

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
