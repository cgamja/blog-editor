## Why

adr-013 트레이드오프의 약속: "zod ↔ PM 스키마 일치 속성 테스트는 editor-core가 생길 때 둘 다 대상으로 한다." #37로 editor-core가 생겼지만 content-convert의 `pmSchema`는 markdown 중간 스키마(꾸미기 attrs 없음 · image 인라인)라 같은 docArbitrary 왕복은 성립하지 않는다(adr-017 트레이드오프 · 이슈 #38). 대신 **변환이 실제로 내놓는 doc**이 에디터 스키마를 무손실로 지나는지를 고정한다 — MCP `create_draft`로 들어온 초안이 에디터에서 열릴 때 바뀌지 않는다는 보장.

## What Changes

- editor-core 테스트: 문서 생성기 → `serializeMarkdown` → `convertMarkdown` 성공 결과 → `docToNode` → `docFromNode`가 변환 결과와 같다(속성 테스트).
- editor-core가 `@blog-editor/content-convert`를 devDependency로 선언한다(허용 엣지 adr-009, 새 외부 라이브러리 아님).

## Impact

- `apps/editor/editor-core/package.json` · `pnpm-lock.yaml`(워크스페이스 링크) · 테스트 파일 하나. 런타임 코드 변화 없음.
- adr-013 약속 이행 — 이슈 #38.
