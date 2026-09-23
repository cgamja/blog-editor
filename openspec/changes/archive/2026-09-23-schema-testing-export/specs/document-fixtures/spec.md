## ADDED Requirements

### Requirement: 테스트용 문서 생성기는 `./testing` 진입점 하나에서 나온다

`@blog-editor/content-schema/testing`은 SHALL `docArbitrary` · `decorationArbitrary` · `naturalSizeArbitrary`를 export하고, 다른 패키지의 property 테스트는 꾸미기 · 원본 크기 생성기를 따로 만들지 않고 이것을 쓴다. 이 진입점은 테스트 파일(`*.test.ts`)과 테스트 지원 파일(`*.arbitrary.ts`)에서만 import할 수 있고, 그 밖의 파일에서 import하면 lint가 실패한다(fast-check가 런타임으로 새지 않게).

#### Scenario: 런타임 파일에서 testing 진입점을 import하면 lint가 막는다

- **WHEN** `packages/content-convert/src/`의 일반 파일과 `apps/editor/api/src/`의 일반 파일에서 `@blog-editor/content-schema/testing`을 import한다
- **THEN** 둘 다 `no-restricted-imports` 에러가 난다

#### Scenario: 테스트 · 테스트 지원 파일에서는 testing 진입점을 쓸 수 있다

- **WHEN** `packages/content-convert/src/`의 `*.test.ts` 파일과 `*.arbitrary.ts` 파일에서 `@blog-editor/content-schema/testing`을 import한다
- **THEN** `no-restricted-imports` 에러가 없다
