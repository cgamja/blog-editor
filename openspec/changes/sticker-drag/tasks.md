# Tasks — sticker-drag (이슈 #61)

## 1. 테스트(Vitest node)

- [ ] 1.1 editor-core `src/commands/sticker-edit.test.ts` — editor-sticker-edit 시나리오 → verify: 빨강 · 실패 원문
- [ ] 1.2 editor-react `src/sticker-ui.test.ts` — editor-sticker-layer의 순수 헬퍼 시나리오 → verify: 빨강 · 실패 원문

## 2. 구현

- [ ] 2.1 editor-core `sticker-edit.ts` · index export → verify: 1.1 초록
- [ ] 2.2 editor-react `sticker-ui.ts` → verify: 1.2 초록
- [ ] 2.3 `StickerLayer.tsx` · `BlogEditor` · `editor.css` · 드롭 플러그인

## 3. 증거 · Converge

- [ ] 3.1 headless shell: 끌어 옮기기 전후 JSON · 스크린샷, 키보드 조작, 콘솔 오류 0 → `.claude/state/evidence/61-sticker-drag/`
- [ ] 3.2 `pnpm verify` 초록 · archive · `openspec validate --all --strict`
