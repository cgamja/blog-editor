## ADDED Requirements

### Requirement: checkSeo는 글 내용 SEO를 규칙으로 점검하고 저장을 막지 않는다

content-schema는 SHALL `checkSeo({ slug?, meta: { title, description, keyword? }, doc, others })`를 export한다. `others`는 다른 글 요약 `{ slug, title, description? }` 목록이다. 이 함수는 AI · 네트워크를 부르지 않는 순수 함수이고, 발견 목록을 돌려줄 뿐 저장 · 발행을 막지 않는다. 발견은 각각 다음을 담는다.

- `level`: `must` · `should` · `info`
- `rule`: 규칙 id
- `target`: 메타 칸 `{ kind: "meta", field }`, 최상위 블록 `{ kind: "block", block }`(1부터), 글 전체 `{ kind: "body" }` 중 하나
- `message`: 무엇이 문제인지
- `fix`: 고칠 방법

글자 수는 NFC로 정규화해 센다(자모가 나뉜 한글도 음절 하나). 목록은 등급(must → should → info) 순서로 정렬하고, 같은 등급 안에서는 위치 순서를 따른다. 규칙은 이렇다.

| 규칙                         | 등급   | 걸리는 때                                                       |
| ---------------------------- | ------ | --------------------------------------------------------------- |
| `image-alt`                  | must   | 이미지 블록의 alt가 공백뿐                                      |
| `heading-missing`            | must   | 소제목(heading)이 하나도 없음                                   |
| `duplicate-title`            | must   | 다른 글과 제목이 같음(앞뒤 공백 · 연속 공백 · 대소문자 무시)    |
| `duplicate-description`      | must   | 다른 글과 설명이 같음. `others`에 설명이 있을 때만              |
| `title-length`               | should | 제목이 권장 범위(`SEO_TITLE_LENGTH`) 밖                         |
| `description-length`         | should | 설명이 권장 범위(`SEO_DESCRIPTION_LENGTH`) 밖                   |
| `first-paragraph-length`     | should | 글자가 있는 첫 최상위 문단이 `SEO_FIRST_PARAGRAPH_MAX`자를 넘음 |
| `keyword-in-title`           | should | `keyword`가 제목에 없음(공백 · 대소문자 무시)                   |
| `keyword-in-first-paragraph` | should | `keyword`가 첫 문단에 없음(공백 · 대소문자 무시)                |
| `keyword-missing`            | info   | `keyword`가 없음                                                |
| `internal-link-missing`      | info   | `others`가 있는데 내부 경로 링크(`/`로 시작, `//` 제외)가 없음  |
| `question-heading`           | info   | 소제목은 있는데 `?`로 끝나는 소제목이 없음                      |
| `body-short`                 | info   | 본문 글자 수(코드 블록 제외)가 `SEO_BODY_MIN_CHARS` 미만        |

#### Scenario: 규칙마다 걸리는 입력과 안 걸리는 입력이 있다

- **WHEN** 규칙마다 그 규칙만 걸리도록 만든 입력과, 모든 규칙을 통과하는 입력으로 `checkSeo`를 부른다
- **THEN** 앞의 입력은 그 규칙의 발견 하나(등급 · 위치 포함)를 담고, 뒤의 입력은 빈 목록이다

#### Scenario: 발견은 등급 순서로 정렬된다

- **WHEN** alt 없는 이미지 · 짧은 제목 · 검색어 없음이 함께 있는 글을 검사한다
- **THEN** 순서가 must(`image-alt`) → should(`title-length`) → info(`keyword-missing`)다

#### Scenario: NFD 한글도 음절로 센다

- **WHEN** 권장 길이 안의 제목 · 설명을 NFD(자모 분리)로 넣어 검사한다
- **THEN** 길이 규칙이 걸리지 않는다

#### Scenario: 자기 자신과는 중복이 아니다

- **WHEN** `others`에 같은 slug · 같은 제목의 글이 있다
- **THEN** `duplicate-title`이 나오지 않는다
