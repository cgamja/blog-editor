# Tasks — block-drag-handle (이슈 #59)

## 1. 테스트

- [ ] 1.1 `apps/editor/editor-core/src/commands/drag-block.test.ts` — 시나리오 7개(손잡이 실브라우저 1개 제외) → verify: 빨강 · 실패 원문

## 2. 구현

- [ ] 2.1 editor-core `commands/drag-block.ts` + index export → verify: 1.1 초록
- [ ] 2.2 editor-react `BlockHandle` · `BlogEditor` 틀 · CSS, 플레이그라운드 여백 → verify: typecheck · lint
- [ ] 2.3 실브라우저: 끌어 놓기 전후 DOM · 스크린샷 · 콘솔 0 → `.claude/state/evidence/59-block-handles/`

## 3. Converge

- [ ] 3.1 시나리오 ↔ 테스트 대조, archive, `openspec validate --all --strict` → verify: `pnpm verify` 초록
