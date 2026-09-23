# Tasks — markdown-serialize (이슈 #20)

기존 코드: `packages/content-convert`에 `convertMarkdown`(md → doc)이 있다. 이 change는 반대 방향 `serializeMarkdown`(doc → md)만 더한다. 문법 원천은 main 스펙 markdown-format · markdown-callout · markdown-directive, 결정은 `design.md`. 새 의존성 없음 — 글자 분류는 이미 쓰는 markdown-it의 `utils`. 테스트는 Vitest node, 테스트 task가 구현보다 먼저이고 `test(convert):` 커밋으로 분리한다. MCP 도구 · 스티커 보존 병합은 하지 않는다(이슈 #20 "하지 않는 것").

## 1. 테스트

- [x] 1.1 `src/serialize.arbitrary.ts` — losses가 비는 유효 doc 생성기(한글 · 문법 글자 · 공백 · 줄바꿈 글자, 마크 조합, 모든 블록). 테스트 전용, index에서 export 안 함 → verify: 생성 doc를 `docSchema.parse`로 만든다
- [x] 1.2 `src/serialize.test.ts` — 스펙 시나리오(예제 + 속성) → verify: `pnpm vitest run packages/content-convert` 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `src/serialize.ts` · `src/serialize-inline.ts` — 블록 직렬화(지시어 줄 · 콜아웃 · 목록 표지 교대 · 펜스 길이) · 인라인(링크 묶음 → 강조 스택 → 코드 스팬, flanking 보정) · 글자 이스케이프 · losses. `index.ts`에서 export → verify: 1.2 초록 + `pnpm test` PASS_TO_PASS

## 3. Converge

- [x] 3.1 스펙 시나리오 6개 ↔ 테스트 대조 → verify: `pnpm verify` 초록 출력
- [x] 3.2 속성 테스트가 찾은 반례 — 줄 첫 링크 안 코드 마크의 `]:`(참조 정의로 읽힘)를 losses `codeMark`로(design.md 7번) · 스펙 시나리오 1개 추가 · 생성기에서 코드 마크의 `:` 제외 → verify: 속성 30,000회 초록(로컬 1회)
