## 1. 변환 → 에디터 왕복

- [ ] 1.1 editor-core devDependency에 `@blog-editor/content-convert` → verify: `pnpm install` 후 lockfile에 workspace 링크만 늘어난다
- [ ] 1.2 속성 테스트(생성기 → serialize → convert → docToNode → docFromNode) → verify: `pnpm vitest run apps/editor/editor-core` 초록, 반례 없음
- [ ] 1.3 `pnpm verify` exit 0
