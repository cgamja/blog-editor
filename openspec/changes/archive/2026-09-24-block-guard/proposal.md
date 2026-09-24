# block-guard (이슈 #41)

## Why

#37로 에디터 스키마가 섰지만, 안쪽 노드의 꾸미기 · 문서 전체 스티커 상한 · attrs 값 범위는 ProseMirror 스키마가 아니라 zod만 막는다(editor-schema 층별 표). 지금은 그런 문서가 편집 중에 만들어지고 저장할 때(`docFromNode`)에야 거부된다 — 사용자는 무엇을 잘못했는지 모른 채 저장이 실패한다. 편집 중에 그 변경 자체가 일어나지 않게 막는다.

## What Changes

- `@blog-editor/editor-core`가 ProseMirror 플러그인 `blockGuard()`를 export한다
- `filterTransaction`: 문서를 바꾸는 트랜잭션의 결과가 닫힌 집합(zod `docSchema`)을 어기면 거부한다. 판정은 `docFromNode`를 그대로 재사용한다 — 규칙의 원천은 content-schema 하나
- 문서를 고치는 부수 효과(`appendTransaction`)는 쓰지 않는다 — 거부만 한다(한글 조합 중 DOM 불일치 방지)

## Impact

- 새 파일 `apps/editor/editor-core/src/plugins/block-guard.ts` · 테스트, `index.ts` export 한 줄
- 새 의존성 없음(`@tiptap/pm/state`는 이미 있는 `@tiptap/pm`)
- 하지 않는 것: 거부 사유를 화면에 알리기(editor-react · 토스트), 붙여넣기 정규화(#42), 우회 meta 키, 블록 split 때 스티커가 복제되는 문제(keepOnSplit — #42가 extensions.ts에서), 감싸기 커맨드가 조용히 거부되는 문제(#45)
