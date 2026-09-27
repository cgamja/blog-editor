# Proposal — blog-seo-skill

## Why

규칙 검사(seo, adr-030)는 빠뜨리면 안 되는 기본만 본다. 글 품질은 AI가 글을 읽고 판단해야 한다. 여기서 글 품질은 E-E-A-T · 읽기 쉬움 · 깊이 · AI 인용 적합성을 말한다.

사용자는 claude-seo로 점수를 매기고 고쳐 왔다. 이 평가를 새 글과 예전 초안 모두에 쓸 수 있게 독립 명령으로 둔다(#150). 느리고 토큰이 들어서 매 수정마다가 아니라, 초안을 다 쓴 뒤 · 발행 전에 쓴다.

## What Changes

- **레포 스킬 `/blog-seo <주소>`** (`.claude/skills/blog-seo/`)
  - Codex용 `.agents/skills/blog-seo`는 원본을 가리키는 링크다(adr-035).
  - 문장은 도구 중립이다.
- **흐름:** `get_post` → 채점 → 고칠 목록 → 사용자 확인 → 부분 고치기(`update_draft`의 `edit`) → 다시 채점 · 전후 비교
  - 규칙 결과는 `check_draft`에 지금 markdown · 글 정보 · slug를 주면 저장 없이 받는다. 점수(#148)가 있으면 점수도 받는다.
  - 품질 채점: Claude Code면 claude-seo(`seo-content`)가 있을 때 그것으로 한다. Codex이거나 claude-seo가 없으면 규칙 결과만 쓴다.
- **지키는 것**
  - `losses`가 있으면 통째로 저장하기 전에 묻는다(`/blog-write`와 같은 규칙).
  - 발행 글은 고치지 않는다. MCP가 거부하므로 초안으로 되돌리는 방법만 안내한다.
- **`/blog-write` 6단계**("원하면 글 품질 깊게 보기")는 이 스킬의 절차를 따른다.
- **테스트:** 두 스킬 모두 example 블록이 형식 검사를 통과한다. Codex 경로는 같은 원본을 가리킨다.

## Impact

- 코드 경로는 바뀌지 않는다. MCP 도구는 6개 그대로이고 새 도구가 없다.
- 받아들인 비용: Codex에는 claude-seo가 없어서 품질 채점이 규칙 결과와 AI 자체 판단에 그친다.
