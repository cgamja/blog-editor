# Spec Delta — markdown-format

## Purpose

AI(MCP `create_draft` · `update_draft`)와 가져오기가 쓰는 markdown **입력** 문법. markdown은 원본이 아니라 입력 전용이고(adr-003) 결과는 항상 `docSchema`(document-schema · decoration-schema)를 지나 저장된다. 이 스펙이 `packages/content-convert/guide/format.md`(`get_writing_guide`가 돌려주는 형식 가이드)와 뒤에 올 변환기의 원천이다.

## ADDED Requirements

### Requirement: 표준 markdown은 1차 블록 · 마크로 1:1 대응한다

변환은 SHALL 다음 표준 문법만 받는다 — 문단 · `##`/`###`(heading level 2/3) · `-` 목록(bulletList) · `1.` 목록(orderedList, 안쪽 목록 중첩 허용) · `>` 인용(blockquote, 안은 문단만) · ``` 펜스(codeBlock, info 문자열 = `language`, `^[a-z][a-z0-9+#.]*$`) · `---`(horizontalRule) · `![alt](/images/<이름>.<확장자>)`(image, 경로만 · alt ≤ 200자) · `**굵게**`(bold) · `*기울임*`(italic) · `` `코드` ``(code) · `[글자](href)`(link, href는 http(s) · mailto · `/` 내부 경로만). 이 밖의 markdown(`#` h1 · h4 이하 · 표 · 취소선 · 각주 · 할 일 목록 · 인라인/블록 HTML · 절대 URL 이미지)은 변환하지 않고 거부한다. 제목 · 설명 등 메타는 markdown 안에 없다(도구 인자).

#### Scenario: 표준 문법 문서가 대응 블록 · 마크의 doc JSON이 된다

- **WHEN** 위 표준 문법을 전부 한 번씩 쓴 markdown을 변환한다
- **THEN** `docSchema`를 통과하는 doc이 나오고 노드 종류가 `heading` · `bulletList` · `orderedList` · `blockquote` · `codeBlock` · `horizontalRule` · `image` · `paragraph`, 마크가 `bold` · `italic` · `code` · `link`로 1:1 대응한다

#### Scenario: 정의 밖 markdown은 거부한다

- **WHEN** `# 제목` · `| 표 |` · `~~취소~~` · `<div>` · `![x](https://a.com/x.png)` · 인용 안의 `## 제목`을 각각 넣는다
- **THEN** 여섯 경우 모두 변환이 실패하고 markdown-validation-message 형식의 메시지가 나온다

### Requirement: 콜아웃은 `:::callout` 컨테이너다

변환은 SHALL `:::callout tone=<note|tip|warning>` 줄로 열고 `:::` 줄로 닫는 컨테이너를 `callout` 노드로 만든다. `tone` 생략 = `note`. 안에는 문단 · 목록만 온다(document-schema의 callout 내용 규칙). 스파이크 #2(markdown-it 컨테이너 플러그인)가 실패하면 ````callout` 펜스 문법으로 바꾸고 이 요구를 수정한다.

#### Scenario: 컨테이너가 tone을 가진 callout이 된다

- **WHEN** `:::callout tone=tip` · 문단 한 줄 · `-` 목록 두 줄 · `:::`를 변환한다
- **THEN** `{ type: "callout", attrs: { tone: "tip" }, content: [paragraph, bulletList] }`가 나오고, `tone` 없이 열면 `tone: "note"`다

### Requirement: 블록 속성은 블록 바로 앞 지시어 줄 `{key=value …}`로 준다

변환은 SHALL 최상위 블록 바로 앞 줄(빈 줄 없이)의 `{font=… motion=… width=…}`를 그 블록 하나의 `attrs`로 옮긴다. 값의 집합은 decoration-schema와 같다(`font` pretendard·jua·gaegu, `motion` fade-in·fade-up·slide-left·slide-right·pop, `width` 25~100 — image/appScreenshot에만). `{frame=app}`는 바로 뒤 이미지를 `appScreenshot`으로 만들고 alt를 `caption`(≤ 120자)으로 쓴다. 지시어 줄은 doc에 글자로 남지 않는다. **스티커는 markdown 문법이 없다** — `stickers` 키를 포함해 정의 밖 키 · 값은 거부한다. 스티커는 사람이 에디터에서만 붙인다.

#### Scenario: 지시어가 바로 다음 블록 하나의 attrs가 된다

- **WHEN** `{font=jua motion=fade-up}` 줄 뒤에 문단, 빈 줄, 문단 하나를 더 쓴다
- **THEN** 첫 문단만 `attrs: { font: "jua", motion: "fade-up" }`이고 둘째 문단에는 `attrs`가 없으며, 두 문단의 글자에 `{…}`가 남지 않는다

#### Scenario: frame=app 이미지는 appScreenshot이 된다

- **WHEN** `{frame=app width=60}` 줄 뒤에 `![기록 화면](/images/record.webp)`를 쓴다
- **THEN** `{ type: "appScreenshot", attrs: { src: "/images/record.webp", caption: "기록 화면", width: 60 } }`가 나온다

#### Scenario: 정의 밖 지시어는 거부한다

- **WHEN** `{stickers=heart}` · `{font=comic}` · `{width=60}`(문단 앞) · `{color=red}`를 각각 넣는다
- **THEN** 네 경우 모두 변환이 실패한다

### Requirement: 형식 가이드의 예시는 전부 유효하다

`packages/content-convert/guide/format.md`는 SHALL 문법마다 예시 하나를 싣고, 예시를 전부 이어 붙인 markdown이 위 규칙으로 변환되어 `docSchema`를 통과해야 한다.

#### Scenario: 가이드 예시를 이어 붙이면 통과한다

- **WHEN** 가이드의 모든 예시 코드 블록을 순서대로 이어 붙여 변환한다
- **THEN** 변환이 성공하고 결과가 `docSchema`를 통과한다

실패 의미론: 해당 없음 — 순수 변환(서버 상태 없음). 실패 메시지는 markdown-validation-message.
