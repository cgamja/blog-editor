## ADDED Requirements

### Requirement: 저장소는 revision이 맞을 때만 글을 지운다

저장소는 SHALL `delete(slug, revision)`로 글을 지운다. 지금 revision과 같을 때만 지우고, 어긋나거나 없는 글이면 `ConflictError`를 던지고 아무것도 바꾸지 않는다.

#### Scenario: 맞는 revision으로 지우면 목록과 조회에서 사라진다

- **WHEN** 글을 쓰고 받은 revision으로 지운다
- **THEN** 조회하면 null이고 목록에 없다

#### Scenario: 낡은 revision으로는 지우지 못한다

- **WHEN** 한 번 고친 뒤 옛 revision으로 지운다
- **THEN** `ConflictError`이고 고친 글이 그대로다
