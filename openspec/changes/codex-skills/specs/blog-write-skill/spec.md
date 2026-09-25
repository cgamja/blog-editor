## ADDED Requirements

### Requirement: 레포 스킬은 Claude Code와 Codex 둘 다에서 보인다

레포 스킬 `blog-write`는 SHALL 원본 하나(`.claude/skills/blog-write/`)만 둔다. Codex가 읽는 `.agents/skills/blog-write`는 그 원본을 가리키는 심볼릭 링크다(adr-035). 그래서 두 경로의 SKILL.md는 늘 같은 내용이다.

스킬 문장은 도구 중립이다. 갈리는 단계만 "Claude Code면 … / Codex면 …"으로 나눈다: MCP 연결 · 스킬 부르는 법 · 글 품질 채점 · AI 이미지.

발행 금지 같은 불변 조건은 어느 쪽에서든 서버가 지킨다(MCP 도구 6개, 발행 도구 없음).

#### Scenario: Codex 경로의 스킬이 Claude Code 경로와 같은 원본이다

- **WHEN** `.agents/skills/blog-write/SKILL.md`와 `.claude/skills/blog-write/SKILL.md`를 읽는다
- **THEN** 두 파일이 있고 내용이 같다. Codex 경로는 Claude Code 경로를 가리키는 링크다

#### Scenario: Codex에서 주제만 주면 방향을 묻고 멈춘다(수동)

- **WHEN** Codex에서 blog-editor MCP를 연결하고 `$blog-write 아이랑 봄 산책 코스`를 준다
- **THEN** 제목 후보 3개 · 목차 · 핵심 검색어 · 카테고리 · 주소 제안이 나오고, 답을 기다린다. 초안은 아직 저장되지 않는다
