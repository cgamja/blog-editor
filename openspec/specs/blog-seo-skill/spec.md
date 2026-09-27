# blog-seo-skill Specification

## Purpose

TBD - created by archiving change blog-seo-skill. Update Purpose after archive.

## Requirements

### Requirement: /blog-seo는 채점하고 확인받은 뒤 부분 고치기로 반영한다

레포 스킬 `blog-seo`는 SHALL 다음 순서로 글 하나를 채점하고 고친다.

1. `get_post`로 글을 읽는다.
2. 저장 없이 `check_draft`(지금 markdown · 글 정보 · slug)로 규칙 결과를 받는다. 점수가 응답에 있으면 점수도 받는다.
3. 고칠 목록을 보여 주고 사용자 답을 기다린다. 답이 오기 전에는 `update_draft`를 부르지 않는다.
4. 확인받은 것만 부분 고치기(`update_draft`의 `edit`)로 반영한다. 글 정보만 바꿀 때는 `title` · `description` · `keyword`를 쓴다.
5. 다시 채점해 전후를 보여 준다.

품질 채점은 쓰는 도구에 따라 다르다.

- Claude Code에 claude-seo가 있으면 그것으로 한다.
- Codex이거나 claude-seo가 없으면 규칙 결과와 직접 판단으로 한다.

부분 고치기가 없어 통째로 저장해야 하는데 `losses`가 비어 있지 않으면, 저장하지 않고 먼저 묻는다.

발행된 글은 고치지 않는다(MCP가 거부한다). 대신 초안으로 되돌리는 방법만 안내한다.

#### Scenario: 채점 결과를 보여 주고 확인 전에는 고치지 않는다(수동)

- **WHEN** 초안이 있는 상태에서 `/blog-seo <주소>`를 준다
- **THEN** 규칙 결과(점수가 있으면 점수)와 고칠 목록이 나오고 답을 기다린다. revision은 그대로다

#### Scenario: 확인하면 부분 고치기로 반영하고 전후를 보여 준다(수동)

- **WHEN** 고칠 목록에 "전부 고쳐"라고 답한다
- **THEN** `update_draft`의 `edit`(또는 글 정보 인자)로 저장된다. 다시 채점한 결과에서 고친 발견이 사라지고 전후가 보인다

### Requirement: /blog-seo는 Claude Code와 Codex 둘 다에서 보인다

`blog-seo`는 SHALL 원본 하나(`.claude/skills/blog-seo/`)만 둔다. `.agents/skills/blog-seo`는 그 원본을 가리키는 링크다(adr-035). `example` 펜스 블록은 모두 `convertMarkdown`을 메시지 없이 통과한다.

`/blog-write`의 "글 품질 깊게 보기" 단계는 이 스킬의 절차를 따른다.

#### Scenario: 스킬 원본 · 링크 · 예시를 검사한다

- **WHEN** `blog-seo`의 두 경로 SKILL.md를 읽고 `example` 블록을 뽑아 변환한다
- **THEN** Codex 경로는 원본을 가리키는 링크이고 내용이 같다. example 블록이 하나 이상이고 모두 통과한다
