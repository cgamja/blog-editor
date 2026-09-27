# Tasks — blog-seo-skill

- [x] 1.1 테스트: blog-seo의 example 블록이 형식 검사를 통과하고 Codex 경로가 같은 원본을 가리킨다(blog-write와 같은 검사를 두 스킬에) → verify: 빨강(스킬 없음)
- [x] 2.1 `.claude/skills/blog-seo/SKILL.md` + `.agents/skills/blog-seo` 링크 → verify: 1.1 초록
- [x] 2.2 `/blog-write` 6단계가 `/blog-seo` 절차를 따르게 → verify: 1.1 초록
- [x] 3.1 실제 실행: Claude Code(`claude -p`) · Codex(`codex exec`)에서 예시 초안 → `/blog-seo` → 고칠 목록 → 확인 → 반영 → 점수 오름(임시 API · 임시 저장 루트 · 사용자 설정 안 건드림) → verify: 수동, 증거 `.claude/state/evidence/150/`
- [x] 3.2 `pnpm verify` → verify: 초록
