# Tasks — editor-react-mount (이슈 #53)

기존 코드: `apps/editor/editor-core/src/*`(editorExtensions · docToNode · docFromNode · blockGuard · MoveBlock · 커스텀 블록 커맨드). 새 의존성은 ADR-019 + 사람 diff 승인(보호 파일은 Edit).

## 1. 의존성

- [x] 1.1 ADR-019 · `apps/editor/editor-react/{package.json,tsconfig.json}` · lockfile → verify: `pnpm install` · `pnpm why prosemirror-model` 한 벌

## 2. 테스트

- [x] 2.1 `src/editor.test.ts` — 스펙 시나리오 4개 → verify: `pnpm vitest run apps/editor/editor-react` 빨강 · 실패 원문

## 3. 구현

- [x] 3.1 `src/{extensions,content,use-blog-editor,BlogEditor,index}.ts(x)` · `src/editor.css` → verify: 2.1 초록
- [x] 3.2 `playground/`(Vite, PORT + strictPort) → verify: 실브라우저(headless) 콘솔 오류 0 · 에디터 DOM · 스크린샷
- [x] 3.3 `docs/ime-checklist.md` 초안(#44) → verify: docs:check

## 4. Converge

- [x] 4.1 시나리오 4개 ↔ 테스트 대조 → verify: `pnpm verify` 초록
