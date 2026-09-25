# Proposal — codex-skills

## Why

사용자(2026-09-25): "관련 스킬 등이 코덱스에서도 되지? 어차피 다 똑같은 tool 쓰는데."

MCP 도구는 같은 서버라 Codex에서도 그대로 된다. 하지만 레포 스킬(`/blog-write`)은 Codex에서 보이지 않는다. 파일 형식(SKILL.md · `name` · `description` 프런트매터)은 같은데 읽는 폴더가 다르다.

- Claude Code는 `.claude/skills/`를 읽는다.
- Codex는 `.agents/skills/`를 읽는다. 작업 디렉터리부터 레포 루트까지 올라가며 찾는다.

스킬 안에는 Claude Code 전용 단계도 있다(#156). claude-seo, `/mcp` 재연결, 이미지를 부를 때의 `codex exec`가 그렇다.

## What Changes

- `.agents/skills/blog-write`를 `.claude/skills/blog-write`를 가리키는 심볼릭 링크로 둔다. 원본은 하나다. Codex 공식 문서에 "심볼릭 링크 스킬 폴더를 따라간다"고 적혀 있다(adr-035).
- 스킬 문장을 도구 중립으로 나눈다. 갈리는 곳만 "Claude Code면 … / Codex면 …"으로 쓴다.
  - MCP 연결
  - 스킬 부르는 법(`/blog-write` · `$blog-write`)
  - 글 품질 채점: claude-seo가 없으면 규칙 결과만 쓴다.
  - AI 이미지 갈림길(#155): Codex는 `$imagegen`, Claude Code는 `codex exec`(ADR-029)
  - 훅이 없는 쪽의 seo 확인
- `docs/mcp-connect.md`에 Codex 연결(`codex mcp add … --url … --bearer-token-env-var …`)을 더한다.
- 테스트: Codex 경로의 SKILL.md가 Claude Code 경로와 같은 원본이다.

## Impact

- 코드 경로는 바뀌지 않는다. MCP 도구 · 초안 규칙 · 보호 파일은 그대로다.
- 받아들인 비용: Windows에서 `core.symlinks`가 꺼져 있으면 심볼릭 링크가 글자 파일로 풀린다. 1단계는 본인용(macOS)이라 감수한다.
- 이후 레포 스킬(`/blog-seo` #150 등)도 같은 방식으로 `.agents/skills/`에 링크한다.
