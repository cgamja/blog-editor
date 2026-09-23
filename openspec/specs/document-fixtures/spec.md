# document-fixtures Specification

## Purpose

render(#6) · convert · API(M1) · 사이트(#8) · Lighthouse 기준선이 같은 글로 시작하도록 대표 문서를 코드로 고정한다. 픽스처는 `@blog-editor/content-schema`의 `fixtures`로 export한다(패키지 진입점은 `index.ts` 하나, adr-009).

## Requirements

### Requirement: 유효 픽스처 셋은 스키마와 정규형을 통과한다

`fixtures`는 SHALL `minimal`(문단 하나) · `allBlocks`(모든 블록 · 마크 한 번씩) · `decorationMax`(글씨체 3종 · 움직임 · 폭 · 스티커 12개 — Lighthouse용)의 `PostFile` 세 개를 담는다. 메타는 `categories: ["studio", "parenting", "parenting-assistant"]`(사이트 `BLOG_CATEGORIES`)로 검증 가능해야 한다.

#### Scenario: 세 픽스처가 파싱 · 정규형 · 현재 버전을 만족한다

- **WHEN** 각 픽스처를 `createPostFileSchema({ categories })`로 파싱하고 `normalize(doc)`와 비교한다
- **THEN** 셋 모두 `success === true`, `normalize(doc)`가 `doc`과 deep-equal(이미 정규형), `schemaVersion === SCHEMA_VERSION`

#### Scenario: allBlocks는 정말 모든 종류를 한 번 이상 쓴다

- **WHEN** `allBlocks.doc`를 순회해 노드 `type`과 마크 `type`을 모은다
- **THEN** 문서 스키마의 노드 12종(`doc` 제외: 최상위 블록 10 + `listItem` + `text`)과 마크 4종이 전부 나타난다

### Requirement: 잘못된 문서 픽스처는 이유와 함께 거부된다 (보호 대상)

`invalidFixtures`는 SHALL `{ name, file, reason, at }` 배열로(`at`은 기대 실패 위치 — zod issue `path` 배열 또는 `"migrate"`) 최소 `javascript-link` · `absolute-image` · `unknown-attr` · `too-many-stickers` · `future-version`을 담는다. 보안 · 데이터 불변식의 회귀 감시가 목적이므로 이 픽스처를 통과시키는 방향으로 스키마를 고치지 않는다.

#### Scenario: 잘못된 픽스처는 전부 거부된다

- **WHEN** 각 `invalidFixtures[i].file`을 `migrate` 후 `createPostFileSchema({ categories })`로 파싱한다(미래 버전은 `migrate`에서 던진다)
- **THEN** 다섯 경우 모두 통과하지 못하고, 실패 위치가 `at`과 일치한다(`at`이 배열이면 그 `path`로 시작하는 zod issue가 있고, `"migrate"`면 `MigrationError`를 던진다)

실패 의미론: 해당 없음 — 상수 데이터.
