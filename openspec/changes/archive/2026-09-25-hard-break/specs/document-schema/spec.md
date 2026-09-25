## MODIFIED Requirements

### Requirement: 1차 블록과 마크만 통과한다

`docSchema`는 SHALL 다음 노드만 받는다.

- 루트 `doc`(content: 최상위 블록 1개 이상)
- 최상위 블록: `paragraph` · `heading`(attrs.level ∈ {2, 3}) · `bulletList` · `orderedList` · `blockquote` · `codeBlock` · `horizontalRule` · `image` · `callout` · `appScreenshot` · `table`
- 안쪽 노드: `listItem` · `tableRow` · `tableCell` · `text` · `hardBreak`

마크는 `bold` · `italic` · `code` · `link` · `strike` · `underline` · `textStyle`(decoration-schema)뿐이다. 모든 객체는 strict이다 — 정의되지 않은 키(노드 타입 · attrs · 마크)는 거부한다.

블록 내용 규칙:

- `paragraph` = 인라인(`text` · `hardBreak`) 0개 이상. 이 규칙은 최상위와 인용 · 목록 항목 · 콜아웃 안 문단에 적용된다. 비어 있으면 `content` 키를 생략할 수 있다(ProseMirror `toJSON`이 빈 content를 생략한다).
- `heading` = `text` 0개 이상(`content` 생략 가능).
- `blockquote` = `paragraph` 1개 이상.
- `listItem` = `paragraph` 1개 + 뒤에 `bulletList`/`orderedList` 0개 이상.
- `callout` = `paragraph` · `bulletList` · `orderedList` 1개 이상.
- `table` = `tableRow` 1개 이상.
- `tableRow` = `tableCell` 1개 이상.
- `tableCell` = attrs 없는 `paragraph` 정확히 1개. 그 안은 `text`만 온다.
- `codeBlock` = 마크 없는 `text` 0개 이상(빈 `content` 생략 가능).
- `horizontalRule` · `image` · `appScreenshot`은 leaf(content 없음)다.

`text.text`는 빈 문자열이 아니고, 한 텍스트의 `marks`에 같은 `type`이 두 번 오지 않는다(ProseMirror 마크 집합과 같은 규칙). `hardBreak`는 `type` 말고는 키가 없다.

#### Scenario: 모든 블록을 한 번씩 쓴 문서가 통과한다

- **WHEN** 위 블록과 마크를 전부 한 번씩 쓴 문서를 `docSchema.safeParse`한다
- **THEN** `success === true`이고 파싱 결과가 입력과 같다(값이 바뀌거나 빠지지 않는다)

#### Scenario: 정의 밖의 노드 · 속성 · 마크는 거부한다

- **WHEN** 다음 다섯 문서를 각각 넣는다
  - `type: "footnote"` 노드
  - `paragraph`에 `attrs.style`
  - `heading.attrs.level = 1`
  - `text`에 `marks: [{ type: "highlight" }]`
  - `marks: [{ type: "bold" }, { type: "bold" }]`(중복)
- **THEN** 다섯 경우 모두 `success === false`

#### Scenario: 내용 규칙 위반을 거부한다

- **WHEN** 다음 네 문서를 각각 넣는다
  - `blockquote` 안에 `heading`
  - `codeBlock` 안에 `bold` 마크가 붙은 텍스트
  - `image`에 `content`
  - `text.text = ""`
- **THEN** 네 경우 모두 `success === false`이고, `content` 키가 없는 `paragraph`는 통과한다

## ADDED Requirements

### Requirement: 강제 줄바꿈은 문단 안에만 온다

`hardBreak`는 SHALL 최상위 문단과 안쪽 문단(인용 · 목록 항목 · 콜아웃 안)에만 온다(adr-028).

- 제목 · 코드 블록 · 표 칸 문단에 오면 거부한다. markdown에서 제목과 표 칸은 한 줄 문법이다.
- 마크나 attrs가 붙은 `hardBreak`는 거부한다.

#### Scenario: 문단 · 목록 항목 안의 강제 줄바꿈은 통과한다

- **WHEN** 최상위 문단 `첫 줄` · `hardBreak` · `둘째 줄`과, 목록 항목 문단 안의 같은 모양을 각각 `docSchema.safeParse`한다
- **THEN** 두 경우 모두 `success === true`

#### Scenario: 제목 · 표 칸 · 마크 붙은 강제 줄바꿈은 거부한다

- **WHEN** 다음 세 문서를 각각 넣는다
  - 제목 안 `hardBreak`
  - 표 칸 문단 안 `hardBreak`
  - `marks: [{ type: "bold" }]`가 붙은 `hardBreak`
- **THEN** 세 경우 모두 `success === false`
