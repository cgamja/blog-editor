## ADDED Requirements

### Requirement: update_draft는 전체 · 부분 · 글 정보만 고친다

`update_draft`는 SHALL 다음 셋 중 하나로 초안을 고친다. 도구 수는 6개 그대로다.

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
