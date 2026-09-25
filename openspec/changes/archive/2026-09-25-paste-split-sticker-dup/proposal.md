# paste-split-sticker-dup (이슈 #126)

## Why

스티커 있는 최상위 문단의 글자 가운데에 블록(닫힌 조각 — ⌘A로 복사한 블록 · 여러 문단)을 붙여넣으면 ProseMirror 교체가 그 문단을 둘로 나누고, 뒤 조각에도 원래 문단의 스티커 배열이 그대로 붙어 스티커가 복제된다(앞 조각은 prosemirror-model 1.25.12 `Node.copy`로 같은 attrs를, 뒤 조각은 prosemirror-transform 1.12.1 `Fitter.close` → `openFrontierNode(node.type, node.attrs)` → `NodeType.create` → `computeAttrs`로 새 attrs에 같은 값을 참조로 옮긴다). 복제된 합이 글 하나 상한(12)을 넘으면 blockGuard가 붙여넣기 전체를 거부해 사용자는 붙여넣기가 조용히 안 되는 것으로 보고, 넘지 않으면 스티커가 조용히 두 벌이 된다. Enter로 나눌 때는 `splitBlockKeepingStickers`가 막지만 붙여넣기 경로에는 그런 처리가 없었다. #65(같은 탭 스티커 복사)는 상한을 셀 때 이 복제분까지 세어 붙인 쪽 스티커를 깎았다.

## What Changes

- editor-core `keepStickersOnOnePiece(tr, selection)`: 교체가 나눈 최상위 블록의 조각(원래 블록과 같은 stickers 배열을 가진 최상위 노드) 가운데 글이 있는 첫 조각에만 스티커를 남긴다 — Enter와 같은 규칙
- editor-core 새 플러그인 `stickerSafePaste()`: 나누게 되는 붙여넣기만 `handlePaste`에서 기본 붙여넣기와 같은 교체를 만들고 조각을 고쳐 한 트랜잭션으로 보낸다(blockGuard가 복제된 결과를 보지 않게). 나누지 않는 붙여넣기 · 조합 중 · 글자 노드 하나짜리 조각 · 이미지 올리기가 파일로 받는 붙여넣기(글 없이 이미지 파일만 온 것)는 기본 동작에 맡긴다. `StickerSafeSplit` 확장이 등록한다
- `stickerClipboard`의 상한 계산이 같은 결과(`pasteTransaction`)로 센다 — 복제분을 세지 않는다

## Impact

- 끌어 놓기는 다루지 않는다 — prosemirror-view 1.42.5 handleDrop은 dropPoint로 닫힌 블록 조각을 블록 경계에 넣어 나누지 않고, 열린 조각의 뒤 조각은 놓은 블록의 속성을 가진다(버린 탐색 테스트로 확인 — replaceRange 결과)
- 안드로이드 조합 중 붙여넣기는 다루지 않는다(web-desktop 가정) — 조합 중이면 기본 붙여넣기 그대로다
- 최상위가 아닌 블록(목록 항목 안 문단 등)의 스티커 자리는 없다(adr-008) — 최상위 블록 조각만 본다
