# markdown-callout Specification

## Purpose

콜아웃(`callout` 노드, tone note/tip/warning)의 markdown 확장 문법. 범위는 markdown-format과 같다(MCP 입력).

## Requirements

### Requirement: 콜아웃은 `:::callout` 컨테이너다

변환은 SHALL `:::callout tone=<note|tip|warning>` 줄로 열고 `:::` 줄로 닫는 최상위 컨테이너를 `callout` 노드로 만든다. `tone` 생략 = `note`. 안에는 문단 · 목록만 온다(document-schema의 callout 내용 규칙). 파서는 markdown-it-container로 확인했다(스파이크 #2, 2026-09-23). prosemirror-markdown은 스키마에 안 맞는 토큰을 오류 없이 버리므로 아래 경계 검사는 토큰 단계에서 한다.

#### Scenario: 컨테이너가 tone을 가진 callout이 된다

- **WHEN** `:::callout tone=tip` · `처음이라면 수유 기록부터 시작해 보세요.` · 빈 줄 · `- 하루 3번이면 충분하다` · `- 시간은 대략이면 된다` · `:::`를 변환한다
- **THEN** `{ type: "callout", attrs: { tone: "tip" }, content: [paragraph, bulletList(항목 2)] }`가 나오고, `:::callout`로만 열면 `tone: "note"`다

### Requirement: 콜아웃 경계 오류는 조용히 삼키지 않는다

변환은 SHALL 닫는 `:::`가 없는 콜아웃을 여는 줄 번호로 거부하고(`문서 (<m>줄)` 형식), 콜아웃 안의 콜아웃 · 목록/인용 안의 콜아웃 · 정의 밖 `tone` · 내용이 없는 콜아웃 · 콜아웃 안의 문단 · 목록 외 블록(제목 · 코드 · 인용 · 구분선 · 이미지) · `callout`이 아닌 이름의 컨테이너(`:::note` · `:::Callout` 등 — 글자로 남기지 않는다)를 거부한다.

#### Scenario: 경계 오류는 전부 거부한다

- **WHEN** 닫는 `:::` 없는 `:::callout tone=tip`(3줄째) · 콜아웃 안의 `:::callout` · 목록 항목 안의 `:::callout` · 인용 안의 `:::callout` · `:::callout tone=danger` · `:::callout` 바로 다음 줄 `:::` · 콜아웃 안의 `## 제목` · 콜아웃 안의 ``` 펜스 · `:::note` · `글` · `:::`를 각각 넣는다
- **THEN** 아홉 경우 모두 변환이 실패하고, 첫 경우의 메시지는 `문서 (3줄): 콜아웃이 닫히지 않았다(받음: ":::callout tone=tip") → 끝에 ":::" 줄 추가`다
