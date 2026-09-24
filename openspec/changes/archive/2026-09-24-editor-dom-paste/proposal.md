# editor-dom-paste (이슈 #42)

## Why

#37로 에디터 스키마가 섰지만 노드 · 마크에 DOM 매핑(`renderHTML` · `parseHTML`)이 없다. 그래서 에디터 화면(editor-react)을 붙일 수 없고, 붙여넣기를 받을 규칙도 없다. 붙여넣기는 닫힌 집합(adr-003 · adr-008) 밖의 모양이 문서로 들어오는 가장 넓은 입구다. 구글 독스 · 워드의 스타일 span, `javascript:` 링크, 외부 절대 URL 이미지, 표가 여기로 들어온다.

## What Changes

- 노드 10종 · 마크 4종의 `renderHTML` · `parseHTML`. 에디터 DOM은 공개 HTML(content-render)과 같은 어휘를 쓴다: `div.post-block[data-font][data-motion][style=--w]` 래퍼, `aside.post-callout[data-tone]`, `figure.post-image` · `figure.post-screenshot`, `code[data-language]`
- attribute 단위 기본 파싱을 막는다. TipTap은 `parseHTML`이 없는 attribute를 HTML 속성에서 그대로 읽는다(`<img width="800">` → 꾸밈 폭 800). 값은 규칙의 `getAttrs`에서 content-schema 상수로 검증한 것만 받는다
- 붙여넣기 정규화 플러그인 `pasteNormalizer()`(`transformPasted`) + 순수 함수 `normalizePastedSlice`. `PasteNormalizer` 확장으로 `editorExtensions`에 들어가 기본으로 켜진다
- 블록 분할 시 스티커 복제 방지(#41 리뷰에서 찾은 버그): 순수 커맨드 `splitBlockKeepingStickers` + Enter 확장 `StickerSafeSplit` — 스티커는 한 블록에만 남는다

## Impact

- editor-core만 바뀐다. 새 의존성은 없다
- 하지 않는 것:
  - DOM을 실제로 파싱하는 끝에서 끝까지 붙여넣기 테스트. 레포에 DOM 구현(happy-dom · jsdom)이 없고, 새 의존성은 LIBRARY 게이트 대상이다. 규칙(`getAttrs`) · `toDOM` 스펙 · Slice 정규화는 node에서 검증하고, 실브라우저 붙여넣기는 #44 체크리스트에 넣는다
  - 스티커 표시(editor-react NodeView), 거부 안내(토스트)
- 실브라우저 미확인(#44로): 한글 조합 중 Enter(스티커 있는 블록 — `StickerSafeSplit`이 코어 Enter보다 먼저 받는다), 에디터 안 끌어 옮기기, 구글 독스 · 워드 원문 붙여넣기
