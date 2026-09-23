# Design — schema-testing-export (이슈 #27)

행동 변화 없는 정리. #24(PR #26) 리뷰의 "문서에 규칙이 없는 영역" 2건과 PR #22 결정 대기(`./testing` export)를 푼다.

## 1. 원본 크기 판정은 스키마가 한 번만 적는다

"둘 다 있거나 둘 다 없음"은 스키마 규칙인데 parser · serialize · render가 같은 조건(`naturalWidth !== undefined && naturalHeight !== undefined`)을 따로 적었다. content-schema가 `naturalSizeOf(attrs) → { width, height } | null`을 공개 API로 내보내고 세 곳이 그것을 쓴다. 짝 검사 refine(`hasNaturalSizePair`)은 스키마 안에서만 쓰므로 내보내지 않는다 — 소비자가 필요한 것은 "있으면 두 값"이다.

## 2. 테스트용 생성기는 `@blog-editor/content-schema/testing` 하나

속성 단위 생성기(`decorationArbitrary` · `naturalSizeArbitrary`)와 `docArbitrary`를 `./testing` 진입점으로 내보낸다. content-convert의 무손실 doc 생성기는 이 속성 생성기를 가져다 쓴다 — 스키마에 꾸미기 속성이 늘면 생성기 한 곳만 고치면 양쪽 property 테스트가 따라온다. content-convert에 남는 것은 markdown 전용 제약(한글 · 문법 글자 텍스트, 스티커 · 빈 문단 없음)뿐이다.

- 매니페스트 `exports`에 `"./testing"` 한 줄(보호 파일 — 사람 diff 승인). fast-check는 루트 devDependency라 새 의존성 없음.
- 진입점을 `index.ts`와 나눈 이유: fast-check가 런타임 번들(api · web)로 새지 않게. 그래서 `./testing`은 테스트 · 테스트 지원 파일(`*.test.ts` · `*.arbitrary.ts`)에서만 import할 수 있고, 그 밖에서는 ESLint `no-restricted-imports`가 막는다(`eslint.config.mjs`, 보호 파일). 경계 테스트(`eslint.boundaries.test.ts`)가 그 규칙을 고정한다.

## 3. 버린 대안

- 중복 유지 — 지금은 싸지만 M6 꾸미기가 늘 때마다 두 생성기를 손으로 맞춰야 하고, 빠뜨려도 초록이다(#24에서 실제로 두 곳을 고쳤다).
- `index.ts`로 내보내기 — fast-check가 런타임 의존이 된다.
