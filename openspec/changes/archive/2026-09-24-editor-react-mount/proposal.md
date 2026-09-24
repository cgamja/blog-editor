# editor-react-mount (이슈 #53)

## Why

M2 완료 조건 "한글 입력 수동 체크리스트 통과"(#44)와 스파이크 #2(TipTap×React19 한글)는 실브라우저에 에디터가 떠야 확인할 수 있다. editor-core(스키마 · 커맨드 · blockGuard · pasteNormalizer · MoveBlock · StickerSafeSplit)가 섰으니 React에 마운트하고, 사람이 만져 볼 개발용 플레이그라운드를 둔다.

## What Changes

- 새 패키지 `apps/editor/editor-react`(`@blog-editor/editor-react`)
  - `blogEditorExtensions()` — editorExtensions + blockGuard를 싣는 확장 + MoveBlock + 커스텀 블록 Backspace 키맵을 한 목록으로 조립
  - `toEditorContent(doc)` — 초기 문서는 반드시 `docToNode`를 지난 JSON(blockGuard 전제: 무효 문서는 에디터에 들어가지 않는다)
  - `readDoc(node)` — 저장용 문서는 `docFromNode`(zod)
  - `useBlogEditor({ doc, key, label })` 훅 — 초기 문서는 마운트 때 한 번, `key`가 바뀔 때만 다시 만든다. `label`은 contenteditable의 aria-label · `BlogEditor` 컴포넌트(`EditorContent` 래퍼) · NodeSelection 표시 CSS
- 개발용 플레이그라운드(`playground/`, Vite, `PORT` env + strictPort) — 픽스처 선택 · 커스텀 블록 · 블록 옮기기 버튼 · 현재 문서 JSON
- 새 의존성(ADR-019): react · react-dom 19.3.0 · @tiptap/react 3.31.3 · vite 8.3.0 · @vitejs/plugin-react 6.1.1 · @types/react · @types/react-dom
- `docs/ime-checklist.md` — #44 실브라우저 체크리스트 초안(결과 칸은 사람이 채운다)

## Impact

- 하지 않는 것: 백오피스 화면 · 라우팅 · API 연동(M3 web) · 꾸미기 패널 · NodeView 디자인 · Tailwind · 감싸기 버튼(#45가 커맨드를 만드는 중 — TODO)
- React 렌더 테스트용 DOM 환경(happy-dom · jsdom)은 들이지 않는다 — 조립 함수는 node에서, 마운트는 실브라우저에서 확인한다
- 후속(이번에 하지 않음):
  - `tsconfig.json`의 `vite/client` 타입이 `src`에도 적용된다 — 플레이그라운드용 tsconfig를 따로 나눌지
  - content-render `post.css`의 `--brand`는 design/tokens.json에 없는 이름이다 — 사이트 토큰과 맞추기
  - 간격 · 크기 토큰이 tokens.json에 없다 — `editor.css`의 `min-height: 12rem`은 토큰이 생기면 교체
  - `.claude/cgamja.json` `commands.dev`에 플레이그라운드 명령 반영(보호 파일)
