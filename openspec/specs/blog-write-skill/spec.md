# blog-write-skill Specification

## Purpose

Claude Code에서 `/blog-write <주제>` 한 번으로 리서치 · 방향 확인 · 본문과 꾸밈 · 저장까지 간다. 방향 확인(제목 후보 · 목차 · 핵심 검색어)에서 한 번 멈추고, MCP 초안 도구만 쓴다 — 발행은 사람이 에디터에서(adr-007).

## Requirements

### Requirement: /blog-write는 방향 확인에서 멈춘다

레포 스킬 `blog-write`는 SHALL 본문을 쓰기 전에 제목 후보 3개 · 목차(h2 · h3) · 핵심 검색어 · 카테고리 · 주소(slug) 제안을 보여 주고 사용자 답을 기다린다. 이 단계를 건너뛰는 옵션은 두지 않는다. 사용자가 답하기 전에는 `create_draft`를 부르지 않는다. 글 종류(앱 소개 · 정보 전달 · 육아 이야기 · 기타)는 이 단계 전에 정한다. 애매하면 묻는다.

#### Scenario: 주제만 주면 방향을 묻고 멈춘다(수동)

- **WHEN** Claude Code에서 `/blog-write 아이랑 봄 산책 코스`를 친다
- **THEN** 제목 후보 3개 · 목차 · 핵심 검색어 · 카테고리 · 주소 제안이 나오고, 답을 기다린다. 초안은 아직 저장되지 않는다

### Requirement: /blog-write는 초안까지만 쓴다

스킬은 SHALL 글을 `create_draft` · `update_draft`로 초안으로만 저장한다. 끝나면 에디터 링크 · 사진이 필요한 자리 목록 · 남은 검사 경고 · 이어서 고치는 법을 알린다. 발행은 사람이 에디터에서 한다(adr-007, MCP에 발행 도구가 없다).

#### Scenario: 끝나면 에디터 링크를 주고 발행은 사람에게 맡긴다(수동)

- **WHEN** 방향 확인에 답하고 스킬이 끝난다
- **THEN** 초안이 저장되고 에디터 링크가 나온다. 발행은 하지 않았다고 알린다

### Requirement: 스킬 안 마크다운 예시는 형식 검사를 통과한다

`.claude/skills/blog-write/SKILL.md`의 `example` 펜스 블록은 SHALL 모두 `convertMarkdown`(`check_draft`와 같은 검사)을 메시지 없이 통과한다. AI가 예시를 그대로 따라 써도 저장이 거부되지 않게 하기 위해서다.

#### Scenario: 스킬의 example 블록을 하나씩 변환하면 모두 통과한다

- **WHEN** SKILL.md의 `example` 블록을 뽑아 하나씩 `convertMarkdown`에 넣는다
- **THEN** 블록이 하나 이상이고, 모두 ok이며 메시지가 없다
