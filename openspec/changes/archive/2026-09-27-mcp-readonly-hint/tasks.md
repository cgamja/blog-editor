# Tasks — mcp-readonly-hint

- [x] 1.1 테스트: `tools/list`에서 읽기 도구 4개는 `readOnlyHint: true`, 쓰기 도구 2개는 아니다 → verify: 빨강(annotations 없음)
- [x] 2.1 `apps/editor/api/src/mcp/tools.ts` 도구 6개에 `annotations`(근거 주석: SDK `ToolAnnotationsSchema` · MCP 스펙 링크) → verify: 1.1 초록 · `pnpm exec vitest run apps/editor/api`
- [x] 2.2 `docs/mcp-connect.md` Codex 절을 `default_tools_approval_mode = "writes"`로, 도구별은 대안으로 · 스킬 안내 맞춤 → verify: `pnpm docs:check`
- [x] 3.1 실제 Codex에서 `writes` 모드로 읽기는 묻지 않고 쓰기 2개만 묻는지 확인 → verify: 수동, 증거 `.claude/state/evidence/159/`(codex-cli 0.153.2 `codex exec` · 임시 API · 사용자 설정 안 건드림: 변경 후 list_posts 통과 · create_draft 승인 요구, 변경 전 list_posts도 승인 요구)
- [x] 3.2 `pnpm verify` → verify: 초록
