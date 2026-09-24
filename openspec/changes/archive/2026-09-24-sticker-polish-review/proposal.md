# sticker-polish-review (PR #76 리뷰 반영)

## Why

PR #76 리뷰 2축에서 다음이 나왔다.

- 24px 한도를 없애자 끌기를 그만둘 방법이 없어졌다. 어디에 놓아도 어딘가에 붙는다.
- 작은 스티커(기본 48px 등)에서 × 칸이 오른쪽 위 조절점과, 회전 손잡이가 왼쪽 위 조절점과 겹친다.
- `:nth-child(An+B of S)`는 구형 브라우저에서 규칙 전체가 무시된다.
- 크기 조절 기준이 누른 점까지의 거리라, 중심 가까이를 누르면 조금만 움직여도 크기가 폭주한다.

## What Changes

- editor-react
  - 끄는 동안 Esc를 누르면 끌기를 취소한다(제자리).
  - 에디터 틀(레이어) 사각형 밖에 놓으면 취소한다(제자리). 가장 가까운 자리 스냅은 틀 안에서만 한다(`isInsideLayer`).
  - 조절점 · 회전 손잡이 · ×의 누르는 칸이 스티커 크기와 상관없이 겹치지 않는다. 작은 스티커는 모서리 조절점을 바깥으로 민다.
  - 숨김 규칙은 `.post-sticker:nth-child(순번 + 2)`로 고른다. 래퍼 구조가 [블록 요소, …스티커]로 고정돼 있다.
  - 크기 조절 기준 거리는 모서리까지의 거리(`cornerDistance`)다.
- editor-core
  - `STICKER_HIDDEN_ATTR`를 `plugins/sticker-hiding.constants.ts`로 옮긴다.
  - `DEFAULT_COORDINATES`를 공개해 패널 드롭 첫 폭이 같은 비율을 쓰게 한다.

## Impact

- editor-core `plugins/sticker-hiding.ts` · `plugins/sticker-hiding.constants.ts`(새) · `index.ts`
- editor-react `sticker-ui.ts` · `sticker-preview.ts` · `sticker-types.ts` · `use-sticker-gesture.ts` · `use-sticker-drop.ts` · `StickerLayer.tsx` · `editor.css`
