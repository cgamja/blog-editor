## MODIFIED Requirements

### Requirement: 1차 블록과 마크만 통과한다

`docSchema`는 SHALL 다음 노드만 받는다 — 루트 `doc`(content: 최상위 블록 1개 이상) · 최상위 블록 `paragraph` · `heading`(attrs.level ∈ {2, 3}) · `bulletList` · `orderedList` · `blockquote` · `codeBlock` · `horizontalRule` · `image` · `callout` · `appScreenshot` · 안쪽 노드 `listItem` · `text`. 마크는 `bold` · `italic` · `code` · `link` · `strike` · `underline` · `textStyle`(decoration-schema)뿐이다. 모든 객체는 strict — 정의되지 않은 키(노드 타입 · attrs · 마크)는 거부한다.

블록 내용 규칙: `paragraph`/`heading` = 인라인(`text`) 0개 이상(비어 있으면 `content` 키를 생략할 수 있다 — ProseMirror `toJSON`이 빈 content를 생략하므로) · `blockquote` = `paragraph` 1개 이상 · `listItem` = `paragraph` 1개 + 뒤에 `bulletList`/`orderedList` 0개 이상 · `callout` = `paragraph` · `bulletList` · `orderedList` 1개 이상 · `codeBlock` = 마크 없는 `text` 0개 이상(빈 `content` 생략 가능) · `horizontalRule` · `image` · `appScreenshot`은 leaf(content 없음). `text.text`는 빈 문자열이 아니고, 한 텍스트의 `marks`에 같은 `type`이 두 번 오지 않는다(ProseMirror 마크 집합과 같은 규칙).

#### Scenario: 모든 블록을 한 번씩 쓴 문서가 통과한다

- **WHEN** 위 블록과 마크를 전부 한 번씩 쓴 문서를 `docSchema.safeParse`한다
- **THEN** `success === true`이고 파싱 결과가 입력과 같다(값이 바뀌거나 빠지지 않는다)

#### Scenario: 정의 밖의 노드 · 속성 · 마크는 거부한다

- **WHEN** `type: "table"` 노드, `paragraph`에 `attrs.style`, `heading.attrs.level = 1`, `text`에 `marks: [{ type: "highlight" }]`, `marks: [{ type: "bold" }, { type: "bold" }]`(중복)을 각각 넣는다
- **THEN** 다섯 경우 모두 `success === false`

#### Scenario: 내용 규칙 위반을 거부한다

- **WHEN** `blockquote` 안에 `heading`, `codeBlock` 안에 `bold` 마크가 붙은 텍스트, `image`에 `content`, `text.text = ""`를 각각 넣는다
- **THEN** 네 경우 모두 `success === false`이고, `content` 키가 없는 `paragraph`는 통과한다
