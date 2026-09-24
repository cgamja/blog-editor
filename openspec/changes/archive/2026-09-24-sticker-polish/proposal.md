# sticker-polish (이슈 #71)

## Why

사용자 피드백(2026-09-24): "스티커가 더 작아지게", "옮길 때 「~에 붙어 있어요」 빼 줘. 잘 옮겨지지도 않고", "키우기 · 줄이기 · 돌리기할 때 커서가 방향에 따라 안 바뀌어 어색하다".

실브라우저 재현(design.md 1)에서 "잘 안 옮겨진다"의 원인이 셋 나왔다.

1. 끄는 동안 원래 스티커가 제자리에 그대로 보이고, 반투명(0.6) 유령만 따라온다. 그래서 스티커가 안 움직이는 것처럼 보인다.
2. 블록 허용 범위(−25~125%)에서 24px보다 멀면 「놓을 수 없어요」로 거절한다. 문서 끝 아래나 큰 여백에 놓으면 아무 일도 일어나지 않는다.
3. 기본 크기 15%가 본문 폭에서 128px라, 스티커가 글자를 가린다.

## What Changes

- editor-core
  - `placeStickerNear`: 24px 한도를 없앤다. 어디에 놓아도 가장 가까운 허용 자리에 붙는다. 범위 밖 값은 여전히 만들지 않는다.
  - `addSticker` 기본 크기 15 → 8.
  - `stickerHiding()` 플러그인 + `hideSticker(ref | null)`: 끄는 동안 원래 스티커를 가리는 노드 장식. 문서는 그대로다.
- editor-react
  - 「~에 붙어 있어요」 꼬리표와 `anchorLabel` · 블록 이름 표를 지운다.
  - 끄는 동안 원래 스티커를 숨기고, 유령을 불투명하게 그린다.
  - 패널에서 끌어 올 때 첫 폭 88px → 48px.
  - 크기 조절점을 네 모서리로 늘리고, 커서는 화면 방향(`resizeCursor`)을 따른다. 회전 손잡이는 회전 커서, 옮기기는 `grab` → `grabbing`.

## Impact

- editor-core `commands/sticker-edit.ts` · `commands/decoration.constants.ts` · `plugins/sticker-hiding.ts`(새) · `index.ts`
- editor-react `StickerLayer.tsx` · `StickerFrame.tsx` · `sticker-preview.ts` · `sticker-messages.ts` · `sticker-ui.ts` · `sticker-types.ts` · `sticker-measure.ts` · `use-sticker-gesture.ts` · `use-sticker-drop.ts` · `extensions.ts` · `editor.css`
- 스키마 · 저장 형식은 그대로다. 최소 크기 5% → 2%는 스키마 변경이라 2단계(P4)에서 한다.
