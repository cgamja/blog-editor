# Tasks — decoration-visible (이슈 #58)

기존 코드: editor-core `dom.ts`(`withDecoration`) · `extensions.ts`, content-render `stickers.ts` · `post.css`, editor-react `editor.css` · `playground/`. 테스트는 Vitest node(DOM 없음), 구현보다 먼저 `test:` 커밋.

## 1. 테스트

- [ ] 1.1 editor-core `dom.test.ts` — 첫 시나리오를 새 spec대로(스티커가 래퍼 안 img로), 스티커만 있는 atom 시나리오 추가 → verify: 빨강 · 실패 원문
- [ ] 1.2 content-render `sticker-assets.test.ts` — 아홉 장 PNG 헤더 크기 = `STICKER_SIZES` → verify: 빨강(파일 없음)
- [ ] 1.3 editor-react `editor-css.test.ts` — 편집 중 움직임 끄기 규칙 → verify: 빨강

## 2. 구현

- [ ] 2.1 `withDecoration` 스티커 래퍼 · img 스펙 → verify: 1.1 초록
- [ ] 2.2 스티커 PNG 9종 복사 → verify: 1.2 초록
- [ ] 2.3 editor.css 움직임 끄기 → verify: 1.3 초록
- [ ] 2.4 플레이그라운드: `/stickers/` 서빙 · 글꼴 링크 → verify: headless 스크린샷(decorationMax) · 콘솔 오류 0

## 3. Converge

- [ ] 3.1 시나리오 ↔ 테스트 대조 → verify: `pnpm verify` 초록 · `openspec validate --all --strict`
