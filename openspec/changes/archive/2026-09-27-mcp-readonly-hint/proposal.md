# Proposal — mcp-readonly-hint

## Why

Codex는 MCP 서버마다 `default_tools_approval_mode = "writes"`를 둘 수 있다. 이 모드는 read-only로 표시되지 않은 도구만 사용자에게 묻는다("The `writes` mode prompts for tools that aren't marked read-only", https://learn.chatgpt.com/docs/extend/mcp?surface=cli). 우리 도구 6개에는 표시(tool annotations)가 없어서, 이 모드로 두어도 읽기 도구까지 모두 묻는다(#159). 그래서 지금 문서는 도구 6개를 하나씩 설정하게 안내한다.

## What Changes

- `tools/list`의 도구마다 `annotations`를 단다(MCP `ToolAnnotations`, https://modelcontextprotocol.io/specification/2025-11-25/schema#toolannotations).
  - 읽기 4개(`get_writing_guide` · `list_posts` · `get_post` · `check_draft`): `readOnlyHint: true`
  - `create_draft`: `readOnlyHint: false` · `destructiveHint: false`(새 초안만, 있는 주소는 거절) · `idempotentHint: true`
  - `update_draft`: `readOnlyHint: false` · `destructiveHint: true`(초안 내용을 바꿔 쓴다) · `idempotentHint: true`(revision이 맞을 때만 쓴다)
  - 모두 `openWorldHint: false` — 이 서버의 저장소 · 설정만 만진다
- `docs/mcp-connect.md` Codex 절: `default_tools_approval_mode = "writes"` 한 줄을 권장하고, 도구별 설정은 대안으로 줄인다. 스킬(blog-write · blog-seo)의 같은 안내를 맞춘다.

## Impact

- 도구 동작 · 인자 · 응답 본문은 바뀌지 않는다. `tools/list` 응답에 표시만 늘어난다.
- 표시는 힌트다. 서버의 불변 조건(발행 도구 없음 · 발행 글 읽기 전용 · revision 조건부 쓰기)은 그대로 서버가 지킨다.
- `writes` 모드에서는 `create_draft`도 묻는다. 비대화형 `codex exec`에서 저장까지 맡기려면 그 실행에 `-c`로 허락하거나 도구별 대안을 쓴다.
