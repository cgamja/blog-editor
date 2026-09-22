---
paths: ["apps/editor/web/**", "apps/editor/editor-react/**"]
---

# 상태 · 데이터

- 문서 상태의 진실은 TipTap `Editor`가 가진 ProseMirror `EditorState` 하나. React는 `useEditorState`로 읽고 커맨드(Transaction)로만 바꾼다. Zustand · 복제 store 금지(adr-006) **[사람 — 리뷰 2축]**
- 서버 상태(글 목록 · 글 + ETag · 저장 · 업로드)는 TanStack Query. 409는 `ConflictError`로 정규화해 UI가 분기한다 **[사람 — 리뷰 2축]**
- 그 밖의 클라이언트 상태(패널 열림 등)는 컴포넌트 지역 상태 → URL. 같은 진실을 두 곳에 두지 않는다 **[사람 — 리뷰 2축]**
- 패키지 밖으로 나가는 것만 각 패키지 `index.ts`에 named export. 패키지 사이는 `@blog-editor/<name>`으로만 넘는다 **[commands.lint]**
