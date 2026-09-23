# ADR-015. 테스트 전용 `./testing` 진입점을 열어 생성기를 패키지 사이에 공유한다 — 런타임 파일은 린트로 막는다

- 날짜: 2026-09-23
- 상태: 승인됨
- 원천: 이슈 #27 · PR #22 결정 대기(`docArbitrary` 공유) · #24(PR #26) 리뷰 "문서에 규칙이 없는 영역" · openspec change `schema-testing-export`
- 대체: adr-009의 "공개 진입점은 각 패키지의 `index.ts` 하나"를 **테스트 전용 진입점에 한해** 일부 대체 · adr-012의 "생성기는 패키지 `index.ts`로 export하지 않는다"를 **`./testing`으로는 export한다**로 일부 대체

## 문제 (맥락)

fast-check 생성기(arbitrary)가 content-schema(`doc.arbitrary.ts` — 정규화 멱등)와 content-convert(`serialize.arbitrary.ts` — md 왕복)에 따로 있었다. #24에서 이미지 원본 크기(`naturalWidth` · `naturalHeight`)를 스키마에 더할 때 두 생성기를 모두 손으로 고쳐야 했고, 한쪽을 빠뜨려도 테스트는 초록이다 — 왕복 property 테스트가 새 속성을 모르는 채로 통과한다. M6에서 꾸미기 속성이 늘 때마다 같은 일이 반복된다.

공유하려면 content-convert가 content-schema의 생성기를 import해야 하는데, adr-009는 패키지의 공개 진입점을 `index.ts` 하나로, adr-012는 생성기를 `index.ts`로 export하지 않는다고 정했다. `index.ts`로 내보내면 fast-check가 런타임 의존이 되어 api · web 번들로 샌다.

## 결정

- content-schema `package.json` `exports`에 **테스트 전용 진입점** `"./testing": "./src/doc.arbitrary.ts"`를 연다. `docArbitrary` · `decorationArbitrary` · `naturalSizeArbitrary`가 나간다. 런타임 공개 API는 여전히 `index.ts` 하나다.
- 다른 패키지의 property 테스트는 꾸미기 · 원본 크기 생성기를 따로 만들지 않고 `@blog-editor/content-schema/testing`에서 가져온다. 각 패키지에 남는 것은 그 패키지 고유의 제약(예: convert의 한글 · markdown 문법 글자 텍스트, 스티커 · 빈 문단 없음)뿐이다.
- **강제 수단**: `eslint.config.mjs`의 `GENERATORS` 규칙 — `fast-check` 직접 import · `*.arbitrary` 생성기 파일 · `@blog-editor/*/testing`은 `*.test.ts(x)`와 `*.arbitrary.ts`에서만 import할 수 있고, 그 밖의 모든 파일(패키지 · 루트 도구 · 스크립트)에서는 `no-restricted-imports` 에러다. 테스트 · 생성기 파일에도 패키지 경계(의존 방향 · TipTap · React · ProseMirror · 상대경로 교차)는 그대로 걸린다. `eslint.boundaries.test.ts`가 두 방향을 고정한다.
- 원본 크기 짝 판정은 테스트 도구가 아니라 스키마 규칙이므로 `./testing`이 아니라 `index.ts`(`naturalSizeOf`)로 내보낸다.

## 버린 대안

- **중복 유지**: 매니페스트를 건드리지 않아 당장은 싸다. 하지만 스키마에 속성이 늘 때마다 두 생성기를 맞춰야 하고, 빠뜨려도 초록이다(#24에서 실제로 두 곳을 고쳤다).
- **`index.ts`로 export**: 진입점이 하나로 남지만 fast-check가 런타임 의존이 된다(adr-012 "배포되지 않는 코드"와 정면 충돌).
- **별도 테스트 유틸 패키지(`packages/testing`)**: 경계가 가장 깨끗하지만 생성기가 스키마 상수와 떨어져 한 패키지가 더 생긴다. 생성기는 스키마의 닫힌 집합과 함께 바뀌므로 스키마 패키지 안에 둔다.

## 감수한 트레이드오프

- 패키지 진입점이 둘이 된다 — "공개 API는 `index.ts`를 보면 된다"가 "런타임 API는 `index.ts`, 테스트 도구는 `./testing`"으로 한 줄 늘어난다.
- 린트 규칙이 파일 이름 관례(`*.test.ts` · `*.arbitrary.ts`)에 기댄다. 관례 밖의 이름으로 생성기를 만들면 규칙이 그 파일을 런타임으로 보고 막는다 — 막히는 쪽으로 틀리므로 받아들인다.
- `eslint.config.mjs`의 경계 블록이 파일당 두 개(런타임 · 테스트 쪽)가 된다.

## 재검토 조건

- 두 번째 패키지가 자기 `./testing`을 열어야 할 때 — 그때는 별도 테스트 유틸 패키지를 다시 본다.
- 번들 분석에서 fast-check가 런타임 산출물에 보일 때(규칙 우회 경로가 있다는 뜻).
