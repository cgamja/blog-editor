# editor-decoration (이슈 #57)

## Why

꾸미기 UI(원래 M6)를 당겨 온다. 스키마(adr-008 닫힌 집합)와 blockGuard는 있지만, 블록에 꾸미기를 넣고 빼는 커맨드가 없다. 꾸미기 패널(#60)과 스티커 끌기(#61)가 이 커맨드 위에 선다. UI가 속성을 직접 `setNodeMarkup`으로 바꾸면 값 검증 · 상한 · 대상 블록 판정이 화면마다 흩어진다.

## What Changes

- editor-core에 꾸미기 커맨드를 둔다(ProseMirror `Command`, React 없음)
  - `setBlockFont(font | null)` · `setBlockMotion(motion | null)` — 선택이 걸친 최상위 블록들
  - `setBlockWidth(percent)` — 그림 · 앱 스크린샷
  - `addSticker(id, placement?)` · `updateSticker(blockPos, index, patch)` · `removeSticker(blockPos, index)` · `moveStickerToBlock(fromPos, index, target)`
- 순수 함수 `placeOnNearestBlock(blocks, point, stickerWidth)` — 블록 사각형(px)과 놓은 점만 받아 가장 가까운 블록과 그 블록 기준 % 좌표를 돌려준다. DOM을 모른다
- 값 검증은 content-schema 상수(`FONTS` · `MOTIONS` · `WIDTH_RANGE` · `STICKER_IDS` · `STICKER_RANGES` · `MAX_STICKERS_PER_DOC`)와 `closed-values.ts`만 쓴다

## Impact

- 새 파일 `apps/editor/editor-core/src/commands/decoration.ts`(+ 테스트), `closed-values.ts`에 `stickerOrNull`, `index.ts` export
- 새 의존성 없음
- 하지 않는 것: 패널 · 끌기 UI(#60 · #61), 에디터 안 스티커 그리기(#58), 키맵
