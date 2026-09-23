# Tasks — content-convert (이슈 #17)

기존 코드: `packages/content-convert`에는 형식 가이드(`guide/format.md`)만 있다. 입력 · 거부 규칙은 main 스펙 markdown-format · markdown-callout · markdown-directive · markdown-validation-message가 원천이고, 이 change는 함수 계약(markdown-convert)만 더한다. 닫힌 집합 상수 · `docSchema` · `hrefSchema` · `imagePathSchema` · `normalize`는 `@blog-editor/content-schema`에서만 가져온다(ESLint 경계, adr-009). 파서는 adr-013 — markdown-it 토큰 단계에서 먼저 검사하고, 통과한 것만 prosemirror-markdown으로 doc를 만든다. 테스트는 Vitest node. 테스트 task가 구현 task보다 먼저이며 `test(convert):` 커밋으로 분리한다. doc → md 직렬화는 하지 않는다(이슈 #17 "하지 않는 것").

## 1. 패키지 뼈대

- [x] 1.1 ADR-013 · `package.json`(prosemirror-markdown · prosemirror-model · markdown-it 14 · markdown-it-container) · `tsconfig.json` → 사람 승인(보호 파일) → 인자 없는 `pnpm install` → verify: `pnpm audit --prod` 취약점 없음
- [x] 1.2 `src/index.ts` + `src/convert.ts` — `convertMarkdown`이 `Error("not implemented")`를 던지는 스텁, 결과 타입 `ConvertResult` export → verify: `pnpm typecheck` 초록

## 2. 변환

- [x] 2.1 `src/convert.test.ts` — 스펙 5개의 `#### Scenario` 20개(markdown-format 5 · markdown-callout 2 · markdown-directive 7 · markdown-validation-message 4 · markdown-convert 2). 거부 시나리오는 `it.each`로 한 테스트 안에서 경우마다 `ok: false`를 본다. 가이드 시나리오는 `guide/format.md`를 `node:fs`로 읽어 info 문자열 `example` 블록을 이어 붙인다 → verify: `pnpm vitest run packages/content-convert` 빨강 · 실패 원문 보고
- [x] 2.2 `src/` 구현 — 지시어 줄 걷어내기(줄 번호 보존) · markdown-it 토큰 검사(정의 밖 · 변형 · 콜아웃 경계 · 지시어 자리) · 메시지 조립(세 칸 · 줄 순) · ProseMirror 스키마 + `MarkdownParser` · 지시어 attrs 붙이기 · `docSchema` 재검증 · `normalize` → verify: 2.1 초록 + `pnpm test` PASS_TO_PASS

## 3. Converge

- [ ] 3.1 스펙 시나리오 20개 ↔ 테스트 대조, 빠진 것은 여기 append. 보안 테스트(`javascript:` 링크 · 절대 URL 이미지 · HTML)는 고쳐서 통과시키지 않는다 → verify: `pnpm verify` 초록 출력
