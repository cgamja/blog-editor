# document-schema Specification

## Purpose

글 본문 `doc`의 닫힌 집합. ProseMirror JSON과 모양이 호환되지만 정의는 zod가 하고, 이 패키지는 ProseMirror를 모른다(adr-003). 모든 입구(에디터 · 가져오기 · MCP)가 저장 전에 이 스키마를 지난다.

## Requirements

### Requirement: 1차 블록과 마크만 통과한다

`docSchema`는 SHALL 다음 노드만 받는다 — 루트 `doc`(content: 최상위 블록 1개 이상) · 최상위 블록 `paragraph` · `heading`(attrs.level ∈ {2, 3}) · `bulletList` · `orderedList` · `blockquote` · `codeBlock` · `horizontalRule` · `image` · `callout` · `appScreenshot` · 안쪽 노드 `listItem` · `text`. 마크는 `bold` · `italic` · `code` · `link`뿐이다. 모든 객체는 strict — 정의되지 않은 키(노드 타입 · attrs · 마크)는 거부한다.

블록 내용 규칙: `paragraph`/`heading` = 인라인(`text`) 0개 이상(비어 있으면 `content` 키를 생략할 수 있다 — ProseMirror `toJSON`이 빈 content를 생략하므로) · `blockquote` = `paragraph` 1개 이상 · `listItem` = `paragraph` 1개 + 뒤에 `bulletList`/`orderedList` 0개 이상 · `callout` = `paragraph` · `bulletList` · `orderedList` 1개 이상 · `codeBlock` = 마크 없는 `text` 0개 이상(빈 `content` 생략 가능) · `horizontalRule` · `image` · `appScreenshot`은 leaf(content 없음). `text.text`는 빈 문자열이 아니고, 한 텍스트의 `marks`에 같은 `type`이 두 번 오지 않는다(ProseMirror 마크 집합과 같은 규칙).

#### Scenario: 모든 블록을 한 번씩 쓴 문서가 통과한다

- **WHEN** 위 블록과 마크를 전부 한 번씩 쓴 문서를 `docSchema.safeParse`한다
- **THEN** `success === true`이고 파싱 결과가 입력과 같다(값이 바뀌거나 빠지지 않는다)

#### Scenario: 정의 밖의 노드 · 속성 · 마크는 거부한다

- **WHEN** `type: "table"` 노드, `paragraph`에 `attrs.style`, `heading.attrs.level = 1`, `text`에 `marks: [{ type: "underline" }]`, `marks: [{ type: "bold" }, { type: "bold" }]`(중복)을 각각 넣는다
- **THEN** 다섯 경우 모두 `success === false`

#### Scenario: 내용 규칙 위반을 거부한다

- **WHEN** `blockquote` 안에 `heading`, `codeBlock` 안에 `bold` 마크가 붙은 텍스트, `image`에 `content`, `text.text = ""`를 각각 넣는다
- **THEN** 네 경우 모두 `success === false`이고, `content` 키가 없는 `paragraph`는 통과한다

### Requirement: 링크 href는 허용 목록 스킴만 통과한다 (보호 대상 — 고쳐서 통과시키지 않는다)

`link` 마크의 `attrs.href`는 SHALL `http://` · `https://`(호스트 필수) · `mailto:<주소>` · `/`로 시작하는 내부 경로(`//`로 시작 금지)만 받는다. 스킴 비교는 대소문자 · 앞뒤 공백 · 제어 문자를 우회로 쓰지 못한다(정규식이 문자열 전체를 본다). 백슬래시(`\`)와 C0 제어 문자(`\x00`~`\x1F` · `\x7F`)는 어디에도 올 수 없다 — WHATWG URL 파서가 특수 스킴에서 `\`를 `/`로 읽어 `/\evil.com`이 외부로 나간다.

#### Scenario: 허용 스킴은 통과한다

- **WHEN** `https://example.com/a?b=1` · `http://localhost:3000` · `mailto:hi@example.com` · `/blog/first-post`를 href로 쓴다
- **THEN** 네 경우 모두 `success === true`

#### Scenario: javascript: 등 위험 스킴은 거부한다

- **WHEN** `javascript:alert(1)` · `JavaScript:alert(1)` · ` javascript:alert(1)` · `data:text/html,x` · `//evil.com` · `ftp://x` · `https://`(호스트 없음) · `/\evil.com` · `https://evil.com\u0001`을 href로 쓴다
- **THEN** 아홉 경우 모두 `success === false`

### Requirement: 이미지 src는 /images/ 경로만 통과한다 (보호 대상)

`image` · `appScreenshot`의 `attrs.src`는 SHALL 기존 `imagePathSchema`(`/images/<이름>.<확장자>`)를 그대로 쓴다. `image.attrs.alt`는 문자열(빈 문자열 허용, 200자 이하), `appScreenshot.attrs.caption`은 문자열(120자 이하)이다.

#### Scenario: 절대 URL 이미지는 거부한다

- **WHEN** `image.attrs.src = "https://cdn.example.com/a.webp"`, `appScreenshot.attrs.src = "/images/../x.webp"`를 쓴다
- **THEN** 두 경우 모두 `success === false`

#### Scenario: 콜아웃 tone과 코드 언어는 닫힌 값이다

- **WHEN** `callout.attrs.tone`에 `note` · `tip` · `warning` 외의 값(`danger`), `codeBlock.attrs.language`에 `Bash Script`(공백 · 대문자)를 쓴다
- **THEN** 두 경우 모두 `success === false`이고, `tone` 3종과 `language` 생략 · `ts` · `c++`은 통과한다

실패 의미론: 해당 없음 — 순수 검증 함수이며 서버 상태를 바꾸지 않는다.
