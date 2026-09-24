# mcp-drafts (이슈 #32)

## Why

M1의 끝(plan 07): 내 Claude에서 초안을 올리면 그 글이 저장소에 들어오고 에디터에서 사람이 발행한다 — 클라우드 없이 끝에서 끝까지. adr-007: AI(채팅 앱)가 서비스를 부르고, 서비스는 LLM을 부르지 않는다. AI는 **초안만** 쓴다.

## What Changes

- `/mcp` — MCP 서버(공식 SDK v2 무상태 fetch 핸들러, adr-016). 도구 6개: `get_writing_guide` · `list_posts` · `get_post` · `check_draft` · `create_draft` · `update_draft`. **발행 도구는 없다.**
- 인증은 연결용 토큰(`Authorization: Bearer`, SHA-256만 저장). 없거나 틀리면 401. 초안 출처는 `meta.source = token:<이름>`
- 쓰기 도구는 content-convert로 markdown → doc 변환 · 검증을 지나고, 글 API와 같은 PostStore · 같은 revision 규칙(어긋나면 충돌)을 쓴다
- 로컬 진입점: `MCP_CONNECTION_TOKEN`이 있으면 `/mcp`를 연다

## Impact

- 새 의존성 `@modelcontextprotocol/server ~2.0.0`(adr-016) · api가 `@blog-editor/content-convert` · `zod`(같은 버전)를 선언
- `apps/editor/api/src/mcp/*`(새 폴더) · `app.ts`(마운트) · `serve.ts`(env 2개) · `index.ts`
- 하지 않는 것: OAuth(다음 change — claude.ai의 Request headers 베타가 없는 계정용), 글쓰기 가이드 편집(설정 API 없음 — 이번엔 형식 가이드만), 초안 개수 한도 · 요청 횟수 제한(M4), 이미지 도구(2단계)
