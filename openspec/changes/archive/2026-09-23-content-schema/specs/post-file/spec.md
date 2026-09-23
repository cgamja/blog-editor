# Spec Delta — post-file

## Purpose

저장 단위 `PostFile = { schemaVersion, meta, doc }`(plan 3-4)과 버전 마이그레이션. 에디터에서 열 때와 공개 API가 렌더할 때 같은 `migrate`를 쓴다(adr-003).

## ADDED Requirements

### Requirement: PostFile은 schemaVersion · meta · doc 세 칸이다

`createPostFileSchema({ categories })`는 SHALL `{ schemaVersion: SCHEMA_VERSION(리터럴), meta: createPostMetaSchema({ categories }), doc: docSchema }` strict 객체 스키마를 돌려준다. `slug`는 파일 안에 없다 — 저장 경로 `workspaces/<id>/posts/<slug>.json`의 키이며 기존 `slugSchema`가 검증한다. 카테고리는 워크스페이스 설정이 주므로 메타와 같이 팩토리다.

#### Scenario: 세 칸이 모두 맞으면 통과한다

- **WHEN** `{ schemaVersion: 1, meta: <유효 메타>, doc: <최소 문서> }`를 파싱한다
- **THEN** `success === true`

#### Scenario: 버전 불일치 · 칸 누락 · 여분 키는 거부한다

- **WHEN** `schemaVersion: 2`, `doc` 누락, 최상위에 `slug: "x"` 추가를 각각 시도한다
- **THEN** 세 경우 모두 `success === false`

### Requirement: migrate는 옛 버전 파일을 현재 버전으로 올린다

`migrations`는 SHALL `(file: unknown) => unknown` 순수 함수 배열이고 `migrations[i]`는 버전 `i+1`을 `i+2`로 올린다. `migrate(raw)`는 `raw.schemaVersion`(양의 정수)부터 `SCHEMA_VERSION`까지 순서대로 적용한 결과를 돌려주며, 검증은 하지 않는다(호출자가 `createPostFileSchema`로 파싱한다). `schemaVersion`이 없거나 양의 정수가 아니거나 `SCHEMA_VERSION`보다 크면 `MigrationError`(어떤 버전을 받았는지 메시지에 포함)를 던진다. 현재 `SCHEMA_VERSION = 1`이므로 `migrations`는 빈 배열이고 `migrations.length === SCHEMA_VERSION - 1`이 불변식이다.

#### Scenario: 현재 버전 파일은 그대로 돌아온다

- **WHEN** `schemaVersion: 1`인 파일을 `migrate`한다
- **THEN** 같은 내용(deep equal)이 돌아오고 입력 객체는 변형되지 않는다

#### Scenario: 미래 버전 · 버전 없음은 MigrationError다

- **WHEN** `schemaVersion: 2`, `schemaVersion` 없음, `schemaVersion: "1"`을 각각 `migrate`한다
- **THEN** 세 경우 모두 `MigrationError`를 던지고 메시지에 받은 값이 들어 있다

#### Scenario: 마이그레이션 배열 길이는 버전과 맞물린다

- **WHEN** `migrations.length`를 읽는다
- **THEN** `SCHEMA_VERSION - 1`과 같다 — 버전을 올리면서 함수를 안 넣으면 이 테스트가 빨강이다

실패 의미론: 해당 없음 — 순수 함수. 저장 · 409는 M1 API 몫.
