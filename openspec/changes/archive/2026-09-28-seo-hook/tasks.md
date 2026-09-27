# Tasks — seo-hook

- [x] 1.1 테스트: `scripts/seo-hook.test.ts` 판정 시나리오(must block · should notify · 상한 · AI가 준 칸 · pass 셋 · 응답 세 모양) → verify: 빨강(e112eb1)
- [x] 2.1 `scripts/seo-hook.lib.ts` 판정 · 진입점(stdin · 상태 파일 · stdout) → verify: `pnpm exec vitest run scripts` 초록, 가짜 stdin 3종(must · should · 다른 도구) 수동 실행
- [x] 2.2 docs/mcp-connect.md · blog-write SKILL.md 문구 갱신 → verify: `pnpm docs:check`
- [x] 2.3 `.claude/settings.json` PostToolUse 등록(사람 승인, 2026-09-28) → verify: 가짜 stdin 3종으로 진입점 실행(must → block · should → systemMessage · 다른 도구 → 출력 없음)
- [ ] 2.4 실제 Claude Code 세션(blog-editor MCP 연결)에서 must가 있는 초안 저장 뒤 되먹임이 온다 → verify: 수동(이 PR 세션에서는 MCP 서버 미연결로 못 함)
- [x] 3.1 `pnpm verify` → verify: 초록
