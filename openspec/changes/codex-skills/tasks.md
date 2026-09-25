# Tasks — codex-skills

- [x] 1.1 테스트: Codex 경로(`.agents/skills/blog-write/SKILL.md`)가 Claude Code 경로와 같은 원본이다 → verify: 빨강(경로 없음)
- [x] 2.1 `.agents/skills/blog-write` → `../../.claude/skills/blog-write` 심볼릭 링크 → verify: 1.1 초록 · prettier · docs:check
- [x] 2.2 SKILL.md 도구 중립 문장(연결 · 부르는 법 · 품질 채점 · AI 이미지 갈림길 · seo 확인) → verify: example 테스트 초록
- [x] 2.3 `docs/mcp-connect.md` Codex 연결 절 · adr-035 → verify: docs:check
- [x] 3.1 실제 Codex에서 `$blog-write`(임시 API · 임시 저장 루트 · 사용자 설정 안 건드림) → verify: 수동, 증거 `.claude/state/evidence/156/`
- [x] 3.2 `pnpm verify` → verify: 초록
