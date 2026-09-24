# markdown-format Specification

## Purpose

MCP 입력(`check_draft` · `create_draft` · `update_draft`)이 쓰는 markdown **입력** 문법. markdown은 원본이 아니라 입력 전용이고(adr-003) 결과는 항상 `docSchema`(document-schema · decoration-schema)를 지나 저장된다. 가져오기(M3)는 손실 목록 흐름(adr-003)이라 별도 change로 미룬다. 이 스펙과 markdown-callout · markdown-directive · markdown-validation-message가 `packages/content-convert/guide/format.md`(`get_writing_guide`가 돌려주는 형식 가이드)와 변환기의 원천이다.

## Requirements

### Requirement: 표준 markdown은 1차 블록 · 마크로 1:1 대응한다

변환은 SHALL 다음 표준 문법을 받는다 — 문단 · `##`/`###`(heading level 2/3) · `-` 목록(bulletList) · `1.` 목록(orderedList) — 글머리 · 순서 모두 안쪽 목록 중첩 허용, 항목 = 문단 하나 + 안쪽 목록 · `>` 인용(blockquote, 안은 문단만) · ``` 펜스(codeBlock, info 문자열 = `language`: 소문자로 시작, 소문자 · 숫자 · `+#.`만, `-` 불가) · `---`(horizontalRule) · `![alt](/images/<소문자·숫자·하이픈>.<webp|png|jpg|jpeg|gif>)`(image, 경로만 · alt ≤ 200자) · `**굵게**`(bold) · `*기울임*`(italic) · `` `코드` ``(code) · `[글자](href)`(link, href는 http(s) · mailto · `/` 내부 경로만). 제목 · 설명 등 메타는 markdown 안에 없다(도구 인자).

#### Scenario: 표준 문법 문서가 대응 블록 · 마크의 doc JSON이 된다

- **WHEN** 위 표준 문법을 전부 한 번씩 쓴 markdown을 변환한다
- **THEN** `docSchema`를 통과하는 doc이 나오고 노드 종류가 `heading` · `bulletList` · `orderedList` · `blockquote` · `codeBlock` · `horizontalRule` · `image` · `paragraph`, 마크가 `bold` · `italic` · `code` · `link`로 1:1 대응한다

### Requirement: 같은 doc가 되는 변형은 받고, 정보를 잃는 변형은 거부한다

변환은 SHALL 결과 doc가 같아지는 표기 변형을 받는다 — `*`/`+` 글머리 · `1)` 구분자 · `_기울임_`/`__굵게__` · `~~~` 펜스 · 들여쓰기 코드 · autolink `<https://…>` · soft break(줄바꿈은 공백 하나). 스키마에 자리가 없어 정보를 잃는 것은 거부한다 — hard break(끝 공백 둘 · `\`) · 1이 아닌 시작 번호 · 글자와 섞인 인라인 이미지 · 링크/이미지 title.

#### Scenario: 줄바꿈은 soft break만 받는다

- **WHEN** 문단 안 줄바꿈 하나(`첫 줄\n둘째 줄`)와 hard break(`첫 줄  \n둘째 줄`)를 각각 변환한다
- **THEN** 앞은 `"첫 줄 둘째 줄"` 텍스트 하나가 되고, 뒤는 거부된다

#### Scenario: 순서 목록은 1부터만 받는다

- **WHEN** `1. 가` · `2. 나`와 `3. 가` · `4. 나`를 각각 변환한다
- **THEN** 앞은 `orderedList`가 되고, 뒤는 거부된다

### Requirement: 정의 밖 markdown은 거부한다

변환은 SHALL 다음을 변환하지 않고 거부한다.

- `#` h1 · h4 이하 · 표 · 각주 · 할 일 목록
- 쓰이지 않는 링크 참조 정의(`[r]: url`)
- 인라인/블록 HTML(`<div>` · `<br>` · `<u>` 포함)
- 절대 URL 이미지
- 인용 안의 제목 · 목록 안의 코드 블록
- 문단 하나 + 안쪽 목록 모양이 아닌 목록 항목(문단 둘 · 안쪽 목록 뒤 문단 · 문단 없이 시작)

쓰인 참조 링크(`[글][r]` + `[r]: url`)는 인라인 링크와 같은 doc가 되므로 받는다. 링크 문법이 보이면(참조 링크 포함) 파서 필터와 무관하게 href를 `hrefSchema`로 검사해 거부한다. `javascript:` 링크를 글자로 조용히 남기지 않기 위해서다. 받은 글자 · 링크가 결과에서 조용히 사라지면 안 된다. 그래서 결과 doc에 자리가 없는 입력은 성공으로 돌려주지 않고 거부한다.

#### Scenario: 정의 밖 markdown은 거부한다

- **WHEN** 다음 열세 가지를 각각 넣는다
  - `# 제목` · 표(`| a | b |` 다음 줄 `|---|---|`) · `<u>밑줄</u>` · `<div>` · `<br>`
  - `![x](https://a.com/x.png)` · `[x](javascript:alert(1))`
  - 인용 안의 `## 제목` · 목록 항목 안의 ``` 펜스
  - 각주(`글[^1]` · 빈 줄 · `[^1]: 설명`) · 할 일 목록(`- [ ] 할 일`)
  - 쓰이지 않는 링크 참조 정의(`글` · 빈 줄 · `[r]: https://a.com`)
  - 목록 항목 안 두 번째 문단(`- a` · 빈 줄 · `  b`)
- **THEN** 열세 경우 모두 변환이 실패하고 markdown-validation-message 형식의 메시지가 나온다

### Requirement: 형식 가이드는 문법마다 예시 하나를 싣고 그 예시는 전부 유효하다

`packages/content-convert/guide/format.md`는 SHALL 문법마다 예시 하나와 실패 메시지 예시 3개를 싣는다. markdown 입력 예시는 info 문자열이 `example`인 코드 블록이고, 그 블록들을 빈 줄 하나로 이어 붙인 markdown은 이 change의 스펙대로 변환되어 `docSchema`를 통과한다.

#### Scenario: 가이드의 example 블록을 이어 붙이면 통과한다

- **WHEN** 가이드에서 info 문자열이 `example`인 코드 블록만 순서대로 빈 줄 하나로 이어 붙여 변환한다
- **THEN** 변환이 성공하고 결과가 `docSchema`를 통과한다

실패 의미론: 해당 없음 — 순수 변환(서버 상태 없음).

### Requirement: 취소선과 괄호 span은 마크가 된다

변환은 SHALL 두 문법을 마크로 바꾼다(ADR-020).

- `~~글자~~` → `strike`
- 괄호 span `[글자]{키=값 …}` → `textStyle`(키 `font` · `weight` · `size` · `color` · `highlight`)과 `underline`(값 없는 키 `underline`)
  - 값은 decoration-schema 집합이다. hex는 대소문자를 받아 소문자로 저장한다
  - 정의 밖 키 · 값, 같은 키 두 번, 글꼴에 없는 두께는 줄 번호가 붙은 실패 메시지가 된다
  - `{…}`가 `키=값`/`underline` 모양이 아니면 span이 아니다. 그 경우 글자 그대로 남는다
  - span 안에는 다른 마크(굵게 · 링크 등)가 올 수 있고, 링크 글자 안의 span도 같은 결과다(링크가 사라지지 않는다)

#### Scenario: span과 취소선이 마크가 된다

- **WHEN** `[강조]{color=brand size=lg underline} 그리고 ~~취소~~ [**굵게**]{highlight=#FFF1CC}`를 변환한다
- **THEN** 결과는 다음과 같다
  - "강조": textStyle `{ color: "brand", size: "lg" }` + `underline`
  - "취소": `strike`
  - "굵게": textStyle `{ highlight: "#fff1cc" }` + `bold`

#### Scenario: span 값 오류는 거부한다

- **WHEN** `[가]{color=pink}` · `[가]{colour=brand}` · `[가]{font=jua weight=light}` · `[가]{size=lg size=xl}`를 각각 변환한다
- **THEN** 넷 모두 실패하고 메시지가 줄 번호와 받은 값을 담는다
