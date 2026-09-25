## ADDED Requirements

### Requirement: scoreSeo는 발견 목록으로 0~100 점수를 매긴다

content-schema는 SHALL `scoreSeo(findings)`를 export한다. 이 함수는 순수 함수이고, `checkSeo`의 발견 목록을 받아 0~100 사이의 정수 점수를 돌려준다.

- 100에서 **규칙 하나당 한 번** 그 등급의 감점(`SEO_LEVEL_PENALTY`)을 뺀다. 같은 규칙이 여러 블록에서 걸려도 한 번만 뺀다(예: alt 없는 이미지가 여럿이어도 `image-alt`는 한 번).
- 0 아래로는 내려가지 않는다.
- 점수는 저장하지 않고 매번 계산한다.
- 점수는 저장 · 발행을 막지 않는다(adr-030).

| 등급   | 감점 |
| ------ | ---- |
| must   | 25   |
| should | 10   |
| info   | 3    |

#### Scenario: 발견이 없으면 100점이다

- **WHEN** 빈 목록으로 `scoreSeo`를 부른다
- **THEN** 100이다

#### Scenario: 등급별로 깎고 같은 규칙은 한 번만 깎는다

- **WHEN** `image-alt`(must) 두 개 · `title-length`(should) · `keyword-missing`(info)로 `scoreSeo`를 부른다
- **THEN** 100 − 25 − 10 − 3 = 62다

#### Scenario: 0 아래로 내려가지 않는다

- **WHEN** must 네 규칙과 should 한 규칙으로 `scoreSeo`를 부른다
- **THEN** 0이다

#### Scenario: 형식 가이드의 감점 표가 코드와 같다

- **WHEN** 형식 가이드 §4의 감점 표를 읽는다
- **THEN** 등급마다 `scoreSeo`가 그 등급 발견 하나에서 깎는 값과 같다

### Requirement: 비교 대상은 web과 MCP가 같은 함수로 만든다

content-schema는 SHALL `seoOthersOf(summaries)`를 export한다. 이 함수는 목록 요약(`{ slug, title?, description? }`)을 `checkSeo`의 `others`로 바꾼다. 제목이 문자열인 항목만 남기고, 설명은 문자열일 때만 싣는다. 에디터 발행 확인(`GET /api/posts` 요약)과 MCP 쓰기 도구(저장소 목록)가 이 함수를 쓴다. 그래서 같은 문서 · 메타 · 글 목록이면 두 곳의 발견과 점수가 같다. 자기 글을 `others`에서 빼는 규칙은 아래 MODIFIED "checkSeo는 글 내용 SEO를 규칙으로 점검하고 저장을 막지 않는다"의 규칙 표(`internal-link-missing` 행)와 겹친다 — 그 행이 원천이다.

#### Scenario: 목록 요약의 모양이 달라도 같은 점수다

- **WHEN** 같은 글들을 API 요약 모양과 저장소 목록 모양으로 각각 `seoOthersOf`에 넣고 같은 문서 · 메타로 `checkSeo`를 부른다
- **THEN** 두 결과 모두 `duplicate-description`을 담고 `scoreSeo` 점수가 같다

### Requirement: checkSeo는 강제 줄바꿈을 글자 하나로 센다

`checkSeo`는 SHALL 문단 글자를 모을 때 강제 줄바꿈(`hardBreak`)을 줄바꿈 한 글자로 읽는다. 그래서 줄 앞뒤 글자가 붙어 한 낱말처럼 읽히지 않고, 첫 문단 길이도 화면에 보이는 글자 수와 같게 센다.

#### Scenario: 줄바꿈이 든 첫 문단의 길이에 줄바꿈이 들어간다

- **WHEN** 첫 문단이 글자 100자 · `hardBreak` · 글자 100자(합 200자)인 글을 검사한다
- **THEN** 첫 문단을 201자로 세어 `first-paragraph-length` 발견이 나온다

## MODIFIED Requirements

### Requirement: checkSeo는 글 내용 SEO를 규칙으로 점검하고 저장을 막지 않는다

content-schema는 SHALL `checkSeo({ slug?, meta: { title, description, keyword? }, doc, others })`를 export한다. `others`는 다른 글 요약 `{ slug, title, description? }` 목록이다. 이 함수는 AI · 네트워크를 부르지 않는 순수 함수이고, 발견 목록을 돌려줄 뿐 저장 · 발행을 막지 않는다. 발견은 각각 다음을 담는다.

- `level`: `must` · `should` · `info`
- `rule`: 규칙 id
- `target`: 메타 칸 `{ kind: "meta", field }`, 최상위 블록 `{ kind: "block", block }`(1부터), 글 전체 `{ kind: "body" }` 중 하나
- `message`: 무엇이 문제인지
- `fix`: 고칠 방법

글자 수는 NFC로 정규화해 센다(자모가 나뉜 한글도 음절 하나). 목록은 등급(must → should → info) 순서로 정렬하고, 같은 등급 안에서는 위치 순서를 따른다. 규칙은 이렇다.

| 규칙                         | 등급   | 걸리는 때                                                                   |
| ---------------------------- | ------ | --------------------------------------------------------------------------- |
| `image-alt`                  | must   | 이미지 블록의 alt가 공백뿐                                                  |
| `heading-missing`            | must   | 소제목(heading)이 하나도 없음                                               |
| `duplicate-title`            | must   | 다른 글과 제목이 같음(앞뒤 공백 · 연속 공백 · 대소문자 무시)                |
| `duplicate-description`      | must   | 다른 글과 설명이 같음. `others`에 설명이 있을 때만                          |
| `title-length`               | should | 제목이 권장 범위(`SEO_TITLE_LENGTH`) 밖                                     |
| `description-length`         | should | 설명이 권장 범위(`SEO_DESCRIPTION_LENGTH`) 밖                               |
| `first-paragraph-length`     | should | 글자가 있는 첫 최상위 문단이 `SEO_FIRST_PARAGRAPH_MAX`자를 넘음             |
| `keyword-in-title`           | should | `keyword`가 제목에 없음(공백 · 대소문자 무시)                               |
| `keyword-in-first-paragraph` | should | `keyword`가 첫 문단에 없음(공백 · 대소문자 무시)                            |
| `keyword-missing`            | info   | `keyword`가 없음                                                            |
| `internal-link-missing`      | info   | 자기 글을 뺀 `others`가 있는데 내부 경로 링크(`/`로 시작, `//` 제외)가 없음 |
| `question-heading`           | info   | 소제목은 있는데 `?`로 끝나는 소제목이 없음                                  |
| `body-short`                 | info   | 본문 글자 수(코드 블록 제외)가 `SEO_BODY_MIN_CHARS` 미만                    |

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

#### Scenario: 자기 글만 있으면 내부 링크를 요구하지 않는다

- **WHEN** 다른 글 목록에 자기 slug의 글만 있는 입력으로 `checkSeo`를 부른다
- **THEN** `internal-link-missing` 발견이 없다
