# editor-core-schema (이슈 #37)

## Why

M2(plan 07) 에디터 코어의 첫 조각. 에디터는 TipTap(ProseMirror) 문서를 다루고 저장은 content-schema(zod) 문서 JSON이 원천이다(adr-003). 두 스키마가 **같은 문서만** 오가게 고정해 두지 않으면, 에디터에서 만든 문서가 저장에서 거부되거나 저장된 문서가 에디터에서 조용히 바뀐다(스파이크 #2의 getSchema 항목).

## What Changes

- 새 패키지 `@blog-editor/editor-core`(React 없음 — adr-002 · adr-009)
- TipTap 확장으로 노드 10종 + 안쪽 `listItem` · `text` · 마크 4종과 꾸미기 · 이미지 attrs를 정의하고 `getSchema`로 ProseMirror 스키마를 만든다
- 경계 함수 둘: `docToNode(schema, raw)`(zod 검증 → ProseMirror 노드) · `docFromNode(node)`(ProseMirror 노드 → 정규형 문서, zod 검증)
- 층별 책임 표: ProseMirror 스키마는 구조(노드 · 마크 이름, content expression, 필수 attrs)를, zod는 값 · attrs 키 · 꾸미기 자리 · 스티커 상한 · URL 허용 목록을 막는다

## Impact

- 새 의존성 `@tiptap/core` · `@tiptap/pm` 3.31.3(adr-002 · adr-017 — 버전은 design.md)
- 하지 않는 것: React · NodeView(editor-react), 커맨드 · 플러그인(blockGuard · pasteNormalizer · 블록 옮기기 — 후속 이슈), 실브라우저 IME 검증(사람), 화면
