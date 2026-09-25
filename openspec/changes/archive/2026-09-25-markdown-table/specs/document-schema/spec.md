## MODIFIED Requirements

### Requirement: 1차 블록과 마크만 통과한다

`docSchema`는 SHALL 다음 노드만 받는다 — 루트 `doc`(content: 최상위 블록 1개 이상) · 최상위 블록 `paragraph` · `heading`(attrs.level ∈ {2, 3}) · `bulletList` · `orderedList` · `blockquote` · `codeBlock` · `horizontalRule` · `image` · `callout` · `appScreenshot` · `table` · 안쪽 노드 `listItem` · `tableRow` · `tableCell` · `text`. 마크는 `bold` · `italic` · `code` · `link` · `strike` · `underline` · `textStyle`(decoration-schema)뿐이다. 모든 객체는 strict — 정의되지 않은 키(노드 타입 · attrs · 마크)는 거부한다.

블록 내용 규칙: `paragraph`/`heading` = 인라인(`text`) 0개 이상(비어 있으면 `content` 키를 생략할 수 있다 — ProseMirror `toJSON`이 빈 content를 생략하므로) · `blockquote` = `paragraph` 1개 이상 · `listItem` = `paragraph` 1개 + 뒤에 `bulletList`/`orderedList` 0개 이상 · `callout` = `paragraph` · `bulletList` · `orderedList` 1개 이상 · `table` = `tableRow` 1개 이상 · `tableRow` = `tableCell` 1개 이상 · `tableCell` = attrs 없는 `paragraph` 정확히 1개 · `codeBlock` = 마크 없는 `text` 0개 이상(빈 `content` 생략 가능) · `horizontalRule` · `image` · `appScreenshot`은 leaf(content 없음). `text.text`는 빈 문자열이 아니고, 한 텍스트의 `marks`에 같은 `type`이 두 번 오지 않는다(ProseMirror 마크 집합과 같은 규칙).

#### Scenario: 모든 블록을 한 번씩 쓴 문서가 통과한다

- **WHEN** 위 블록과 마크를 전부 한 번씩 쓴 문서를 `docSchema.safeParse`한다
- **THEN** `success === true`이고 파싱 결과가 입력과 같다(값이 바뀌거나 빠지지 않는다)

#### Scenario: 정의 밖의 노드 · 속성 · 마크는 거부한다

- **WHEN** `type: "footnote"` 노드, `paragraph`에 `attrs.style`, `heading.attrs.level = 1`, `text`에 `marks: [{ type: "highlight" }]`, `marks: [{ type: "bold" }, { type: "bold" }]`(중복)을 각각 넣는다
- **THEN** 다섯 경우 모두 `success === false`

#### Scenario: 내용 규칙 위반을 거부한다

- **WHEN** `blockquote` 안에 `heading`, `codeBlock` 안에 `bold` 마크가 붙은 텍스트, `image`에 `content`, `text.text = ""`를 각각 넣는다
- **THEN** 네 경우 모두 `success === false`이고, `content` 키가 없는 `paragraph`는 통과한다

## ADDED Requirements

### Requirement: 표는 직사각형이고 첫 행이 머리 행이다

`docSchema`는 SHALL `table`의 모든 행이 같은 수의 칸을 가질 때만 받는다(adr-028). 첫 행이 머리 행이다 — 머리 칸을 가리는 노드 종류는 없다. `tableCell.attrs.align`(`center` · `right`)은 그 열의 정렬이고 첫 행 칸에만 올 수 있다. 표는 최상위에만 오고, 표 attrs는 꾸미기 `font` · `motion` · `stickers`뿐이다(정렬 · 폭 없음). 칸 안 문단에는 attrs가 없다. 정규형은 `align: "left"`를 지운다(정렬 없음과 같은 모양).

#### Scenario: 머리 행에 정렬이 있는 2×2 표가 통과한다

- **WHEN** 첫 행 칸 둘(둘째 칸 `align: "center"`) · 둘째 행 칸 둘인 표를 `docSchema.safeParse`한다
- **THEN** `success === true`다

#### Scenario: 모양이 어긋난 표는 거부한다

- **WHEN** 행마다 칸 수가 다른 표, 둘째 행 칸에 `align`이 있는 표, 칸에 문단이 둘인 표, 인용 안의 표를 각각 넣는다
- **THEN** 네 경우 모두 `success === false`다
