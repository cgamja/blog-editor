# tasks — editor-dom-paste (#42)

## 1. DOM 매핑 · 붙여넣기

- [x] 1.1 editor-dom 시나리오 4개 → `src/dom.test.ts`(가짜 요소 헬퍼 `src/dom.test.helpers.ts`)
      → verify: `pnpm vitest run apps/editor/editor-core` 에서 red(기능 없음) 확인
- [x] 1.2 editor-paste 시나리오 9개 → `src/plugins/paste-normalizer.test.ts`
      → verify: red 확인, 원문을 test 커밋 본문에
- [x] 1.3 `src/closed-values.ts` · `src/dom.ts` · `extensions.ts` renderHTML/parseHTML(모든 attribute 기본 파싱 막기) · `src/plugins/paste-normalizer.ts` + `PasteNormalizer` 확장
      → verify: 1.1 · 1.2 초록, 기존 schema.test 초록

## 2. 블록 분할 시 스티커

- [x] 2.1 editor-schema 분할 시나리오 3개 → `src/commands/split-block.test.ts`
      → verify: red 확인(스티커 복제 · 맨 앞 · 코드 블록)
- [x] 2.2 `stickers` `keepOnSplit: false` · 순수 커맨드 `splitBlockKeepingStickers`(prosemirror-commands `splitBlockAs`) · Enter 확장 `StickerSafeSplit`
      → verify: 2.1 초록

## 3. 마무리

- [x] 3.1 `pnpm verify`
      → verify: exit 0
