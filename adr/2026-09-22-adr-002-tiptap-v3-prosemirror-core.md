# ADR-002. 에디터 엔진은 TipTap v3, 핵심 로직은 ProseMirror 순수 함수로 짠다

- 날짜: 2026-09-22
- 상태: 승인됨
- 원천: 설계 문서 D3 · 01 「에디터 엔진 결정」 (2026-09-20)

## 문제 (맥락)

contentEditable을 직접 다루면 브라우저마다 다른 DOM 변이, 한글 조합(IME) 중 재렌더, 선택 영역 복원을 전부 우리가 진다(Medium 2014 · 당근 2025). 반면 완제품 에디터는 저장 형식과 확장 지점을 자기 것으로 가져가 버린다. 어디까지 라이브러리에 맡기고 어디부터 우리 코드인가.

## 결정

- **TipTap v3**(`@tiptap/core` · `@tiptap/react` · `@tiptap/pm` + 노드 · 마크 확장 개별 설치). ProseMirror는 `@tiptap/pm`이 다시 내보내는 것만 써서 버전을 하나로 유지한다. `immediatelyRender: false`.
- 커맨드 · 플러그인 로직은 **ProseMirror 순수 함수 `(state, dispatch) => boolean`**으로 `editor-core`에 짠다. TipTap 확장은 그것을 등록만 한다. 그래서 DOM 없이 Vitest(node)에서 테스트한다.
- 커스텀 블록의 화면은 `ReactNodeViewRenderer`, 편집 가능한 내용은 `NodeViewContent`.
- **TipTap은 `editor-core` · `editor-react` 밖으로 나가지 않는다.** ESLint가 강제한다.
- 조합(IME) 원칙: `view.composing` 동안 문서를 바꾸는 부수 효과를 실행하지 않는다.

## 버린 대안

- **ProseMirror 직접**: 자유도는 최고지만 React 연결 · 확장 조립 · 기본 확장을 다 짜야 한다. TipTap이 그 층을 얇게 덮어 주고, 우리는 그 밑의 ProseMirror API를 그대로 쓸 수 있다.
- **Lexical**: 자체 모델(EditorState 노드 트리)이고 ProseMirror만큼 문서와 사례가 두텁지 않다. 한글 IME 이슈 이력이 있었다.
- **Slate**: 조합 처리와 안정성에서 ProseMirror에 밀린다(이단비 2024 도입기).
- **직접 contentEditable**: 학습 목표(plan 08)로만 남긴다. 제품 코드에는 안 쓴다.

## 감수한 트레이드오프

- TipTap의 추상(확장 시스템 · 커맨드 체인)을 배워야 하고, 메이저 업그레이드 시 따라가야 한다.
- 화면 층 테스트는 jsdom으로 안 된다 — Playwright + 한글 수동 체크리스트를 릴리스마다 돈다(브라우저 업데이트로 조합이 깨진 전례 ProseMirror #1484).
- AI가 ProseMirror/TipTap API를 그럴듯하게 틀리게 쓰기 쉬운 영역이다. 공식 문서를 근거로 달고 실브라우저에서 확인한다.

## 재검토 조건

- M0 스파이크에서 TipTap v3 × React 19 × Vite 조합의 한글 조합이 깨지면 버전을 내려 고정하고, 그래도 안 되면 이 ADR을 대체한다.
- 협업 편집(Y.js)이 필요해질 때 — TipTap이 지원하므로 대체가 아니라 확장이 될 가능성이 높다.
