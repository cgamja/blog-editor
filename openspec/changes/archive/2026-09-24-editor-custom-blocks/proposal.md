# editor-custom-blocks (이슈 #40)

## Why

M2(plan 07)의 커스텀 블록 2개 — 콜아웃(`callout`)과 앱 스크린샷(`appScreenshot`). #37로 에디터 스키마는 섰지만 이 블록을 넣고 바꾸는 편집 동작이 없다. 또 ProseMirror 기본 Backspace(`joinBackward`)는 콜아웃 **바로 뒤** 문단 맨 앞에서 누르면 그 문단을 콜아웃 안으로 빨아들인다 — 사용자가 뜻한 "앞 블록으로 가기"와 다르다(plan 05 실브라우저 목록의 "커스텀 블록 바로 뒤 Backspace").

## What Changes

- editor-core에 순수 함수 커맨드 넷(ProseMirror `Command`): `insertCallout(tone)` · `setCalloutTone(tone)` · `insertAppScreenshot({ src, caption })` · `backspaceAfterCustomBlock`
- 모든 커맨드는 적용할 수 없으면 dispatch 없이 `false`, 결과 문서는 항상 `docFromNode`(zod)를 통과한다

## Impact

- 새 파일만: `apps/editor/editor-core/src/commands/custom-blocks.ts`(+ 테스트 · 테스트 헬퍼), `index.ts`에 export 줄
- 새 의존성 없음(`@tiptap/pm`의 `state` · `model`만)
- 하지 않는 것: 키맵 등록 · 툴바 · NodeView(editor-react), 실브라우저 확인(사람 — IME 체크리스트 #44), blockGuard(#41)
