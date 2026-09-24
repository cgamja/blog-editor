# Design — decoration-panel

## 1. 상태는 EditorState에서 파생한다

- 패널이 보여 주는 값(대상 블록 · 글씨체 · 움직임 · 폭 · 스티커 개수)은 `decorationPanelStateOf(state)` 하나가 만든다. React는 `useEditorState`의 selector로 이것만 읽는다(https://tiptap.dev/docs/editor/getting-started/install/react#optimize-your-performance). 복제 store 없음(adr-006, .claude/rules/state.md).
- 가능 여부는 커맨드를 dispatch 없이 불러 판정한다. #57이 "can과 실행이 같은 답"을 테스트로 고정했으므로, 패널이 규칙을 다시 적지 않는다(https://prosemirror.net/docs/ref/#state.Command).
- 대상 표시는 선택의 첫 최상위 블록 기준이다. 커맨드는 선택이 걸친 최상위 블록 전부에 적용된다 — 여러 개면 "블록 N개"라고 적는다.

## 2. 비활성 이유

- 대상 없음(GapCursor · AllSelection): "꾸밀 블록을 먼저 고르세요"
- 가질 수 없는 속성: "코드 블록에는 글씨체를 줄 수 없어요"처럼 블록 이름을 넣는다
- 스티커 상한: "스티커는 글 하나에 12개까지예요"(MAX_STICKERS_PER_DOC)
- 이유 문장은 `aria-describedby`로 해당 컨트롤에 잇는다. 비활성 버튼은 `disabled`(네이티브).

## 3. 움직임 미리 보기 = 노드 장식

- 편집 화면은 움직임을 재생하지 않는다(#58). 미리 보기는 editor-core 플러그인이 고른 블록에 `Decoration.node(…, { class: "editor-motion-preview" })`를 단다(https://prosemirror.net/docs/ref/#view.Decoration^node). ProseMirror가 관리하는 DOM에 클래스를 직접 넣으면 DOMObserver가 되돌린다 — 장식이 공식 경로다.
- editor.css가 그 클래스에만 시간 기반 애니메이션(0.6초)을 준다. 키프레임은 post.css의 것(`post-fade-in` 등)을 이름으로 쓴다. `animation-timeline: view()`를 지원하지 않는 브라우저는 post.css가 키프레임을 만들지 않아 미리 보기도 없다(글에서도 움직임이 없으니 같은 결과).
- 장식은 1초 뒤 `endMotionPreview`로 뗀다(React 타이머). 블록이 지워지면 매핑에서 사라진다.
- 움직임을 줄인 사용자(`prefers-reduced-motion: reduce`)에게는 버튼을 비활성으로 두고 안내만 보인다.

## 4. 폭 도구줄

- 그림 · 앱 스크린샷을 NodeSelection으로 골랐을 때만 뜬다. 위치는 `view.nodeDOM(pos)`의 사각형을 도구줄의 offsetParent 기준으로 잰다(https://prosemirror.net/docs/ref/#view.EditorView.nodeDOM). 블록 위 가운데.
- 버튼은 작게 50 · 보통 70 · 꽉 차게 100(결정 2026-09-24). 지금 폭이 그 값이면 `aria-pressed`. 폭이 없으면 100으로 본다(렌더러 `--w` 기본값).
- 1% 단위 끌기(모서리 조절점)는 하지 않는다.

## 5. 스티커 이미지

- 패널은 `stickerSrc?: (id) => string`을 받는다. 없으면 글자 버튼(스티커 이름)으로 보인다. 이미지 파일을 레포에 두는 일은 #58이다.
