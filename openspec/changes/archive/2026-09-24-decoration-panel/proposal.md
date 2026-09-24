# decoration-panel (이슈 #60)

## Why

꾸미기 커맨드(#57)가 editor-core에 생겼지만 사람이 누를 곳이 없다. 디자인 `69:2`의 오른쪽 「꾸미기」 탭(글씨체 3종 · 스티커 9종 · 움직임 · 움직임 미리 보기)과 그림 위에 뜨는 폭 도구줄(작게 · 보통 · 꽉 차게)을 editor-react 컴포넌트로 만든다. 디자인 결정(2026-09-24): 움직임은 스키마 5종 + 없음, 폭 50 · 70 · 100.

## What Changes

- editor-react `DecorationPanel` — 지금 고른 블록 표시, 글씨체 · 스티커 · 움직임 · 미리 보기. 못 쓰는 항목은 비활성 + 이유
- editor-react `WidthToolbar` — 그림 · 앱 스크린샷을 노드로 골랐을 때 블록 위에 뜨는 도구줄
- 패널 상태는 `decorationPanelStateOf(EditorState)` 순수 함수로 파생한다. 가능 여부는 커맨드를 dispatch 없이 불러 판정한다(can = 실행, #57)
- editor-core `motionPreview` 플러그인 · `previewMotion` · `endMotionPreview` — 고른 블록에 노드 장식 클래스를 잠깐 달아 움직임을 한 번 재생한다
- 플레이그라운드에 패널 · 도구줄을 붙인다

## Impact

- editor-react: `decoration-state.ts` · `DecorationPanel.tsx` · `WidthToolbar.tsx` · `editor.css` · `extensions.ts`(플러그인 등록) · `index.ts`
- editor-core: `plugins/motion-preview.ts` · `index.ts`
- 새 의존성 없음. #62(#57) 위에 쌓는다
- 하지 않는 것: 탭 틀 · 「글 정보」(M3 web) · 스티커 끌어다 놓기 · 고르기(#61) · 스티커 이미지 파일(#58 — 패널은 `stickerSrc`를 받기만 한다) · 모서리 조절점으로 폭 끌기(M5)
