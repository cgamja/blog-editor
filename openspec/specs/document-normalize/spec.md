# document-normalize Specification

## Purpose

정규형 하나(adr-003): 같은 글은 같은 JSON이 되어야 저장 버전끼리 비교했을 때 실제 변경만 보인다. 마크 순서 · 인접 텍스트 · 키 순서가 입구(에디터 · 변환 · AI)마다 달라지는 것을 여기서 지운다.

## Requirements

### Requirement: normalize는 검증된 문서를 정규형으로 만든다

`normalize(doc)`는 SHALL `docSchema`를 통과한 문서를 받아 새 객체를 돌려주며(입력 불변) 다음을 보장한다: ① 각 `text`의 `marks`는 `type` 이름의 사전순(`bold` < `code` < `italic` < `link`)이고 `marks: []`는 키 자체를 지운다 ② 같은 부모 안에서 인접한 `text` 노드의 마크가 deep-equal이면 하나로 합친다(순서 ①을 먼저 적용한 뒤 비교) ③ 모든 객체의 키 순서는 `type` · `attrs` · `content` · `marks` · `text`이고 `attrs` 안의 키는 사전순, `attrs: {}`는 키 자체를 지운다 ④ `content: []`는 키 자체를 지운다(ProseMirror `toJSON`과 같은 모양이 정규형). 블록 노드의 종류 · 개수 · 순서와 이어 붙인 텍스트 내용은 보존한다(②로 `text` 노드 개수는 줄 수 있다).

#### Scenario: 마크 순서가 다른 두 입력이 같은 출력이 된다

- **WHEN** 텍스트 하나에 `[italic, bold]`, 다른 문서에 `[bold, italic]`을 붙여 각각 `normalize`한다
- **THEN** 두 결과가 deep-equal이고 마크는 `[bold, italic]` 순서다

#### Scenario: 마크가 같은 인접 텍스트를 합친다

- **WHEN** 문단에 `"안녕"`(bold) · `"하세요"`(bold) · `" 반가워요"`(마크 없음) 세 텍스트가 있다
- **THEN** 결과 문단은 `"안녕하세요"`(bold) · `" 반가워요"` 두 텍스트다

#### Scenario: 링크 href가 다르면 합치지 않는다

- **WHEN** 인접한 두 텍스트가 모두 `link` 마크지만 `href`가 다르다
- **THEN** 두 텍스트가 그대로 남는다

#### Scenario: 키 순서가 고정된다

- **WHEN** `{ content: [...], type: "paragraph", attrs: { motion: "pop", font: "jua" } }`처럼 키를 뒤섞은 문서를 `normalize`한 뒤 `JSON.stringify`한다
- **THEN** 문자열이 `{"type":"paragraph","attrs":{"font":"jua","motion":"pop"},"content":[...]}`로 시작한다

### Requirement: normalize는 멱등이다

`normalize(normalize(doc))`는 SHALL `normalize(doc)`와 deep-equal이다. 예제가 아니라 생성된 문서 전체에 대해 성립해야 하므로 속성 기반 테스트(fast-check, LIBRARY 게이트 통과 시)로 검사한다. 게이트를 통과하지 못하면 손으로 만든 문서 5개 이상(모든 블록 · 꾸미기 최대 · 마크 조합)으로 대체하고 그 사실을 tasks에 남긴다.

#### Scenario: 임의의 유효 문서에서 두 번 적용해도 같다

- **WHEN** `docSchema`를 통과하는 임의 문서(arbitrary)를 100회 생성해 `normalize`를 한 번, 두 번 적용한다
- **THEN** 매번 두 결과가 deep-equal이고, 결과도 `docSchema`를 통과한다

실패 의미론: 해당 없음 — 순수 함수.
