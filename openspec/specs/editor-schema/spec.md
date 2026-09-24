# editor-schema Specification

## Purpose

에디터(TipTap v3)의 ProseMirror 스키마가 문서 스키마(content-schema, zod)와 같은 집합만 받는다 — `docToNode` · `docFromNode` 경계에서 zod를 앞뒤로 걸고, 어느 층이 무엇을 거부하는지 표로 고정한다(adr-002 · adr-017).

## Requirements

### Requirement: 저장 문서는 에디터 스키마를 오가도 바뀌지 않는다

`@blog-editor/editor-core`는 SHALL `createEditorSchema()`(TipTap 확장 → `getSchema`)와 경계 함수 둘을 export한다. `docToNode(schema, raw)`는 raw를 content-schema `docSchema`로 먼저 검증한 뒤 ProseMirror 노드로 만들고 `check()`까지 통과시킨다. `docFromNode(node)`는 ProseMirror의 빈 attrs(`null`)를 지우고 정규형(`normalize`)으로 만든 뒤 `docSchema`로 검증한 문서를 돌려준다. 유효한 문서 `d`에 대해 `docFromNode(docToNode(schema, d))`는 `normalize(d)`와 같다.

#### Scenario: 대표 픽스처 셋이 왕복해도 같다

- **WHEN** content-schema 유효 픽스처(`minimal` · `allBlocks` · `decorationMax`)의 doc을 각각 `docToNode` → `docFromNode`로 돌린다
- **THEN** 결과가 원래 doc의 `normalize` 결과와 같다

#### Scenario: 생성기가 만든 문서도 왕복해도 같다

- **WHEN** `@blog-editor/content-schema/testing`의 `docArbitrary`가 만든 문서를 `docToNode` → `docFromNode`로 돌린다
- **THEN** 모든 표본에서 결과가 원래 문서의 `normalize` 결과와 같다

### Requirement: 층마다 막는 것이 정해져 있다

에디터로 들어오는 문서는 SHALL 두 층을 지난다. ProseMirror 스키마만으로는 모르는 attrs를 **조용히 버리고**, attrs 값을 검사하지 않으며, `attrs`가 아예 없는 노드는 필수 attrs까지 `null`로 채우므로, attrs 규칙은 zod가 먼저 막는다.

| 무엇                                                                                                                                                                                                                                                                    | 막는 층                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 모르는 노드 · 마크 이름, 노드 안에 올 수 있는 자식(content expression), 빈 문서 · 빈 텍스트                                                                                                                                                                             | ProseMirror 스키마                                  |
| 필수 attrs(`heading.level` · `callout.tone` · `image.src/alt` · `appScreenshot.src/caption` · `link.href`) 누락, attrs 값(enum · 정수 범위 · 원본 크기 짝), 모르는 attrs 키, 꾸미기 자리(안쪽 노드에는 없다), 문서 전체 스티커 상한, `href` 스킴 허용 목록, 이미지 경로 | zod(`docSchema`) — `docToNode` · `docFromNode` 양쪽 |

#### Scenario: zod만 잡는 잘못된 픽스처는 에디터에 들어오지 못한다

- **WHEN** content-schema 잘못된 픽스처 중 doc이 원인인 넷(`javascript-link` · `absolute-image` · `unknown-attr` · `too-many-stickers`)을 `docToNode`에 넣는다
- **THEN** 모두 거부된다

#### Scenario: 구조 위반은 ProseMirror 스키마가 거부한다

- **WHEN** 빈 문서, 모르는 노드 이름, 빈 텍스트, 인용 안의 제목, 첫 자식이 목록인 목록 항목, 코드 블록 안 굵은 글씨, 목록 항목 안의 이미지를 ProseMirror 스키마에 바로(`Node.fromJSON` → `check`) 넣는다
- **THEN** 모두 거부된다

#### Scenario: 안쪽 노드의 꾸미기는 저장 쪽 경계에서 거부된다

- **WHEN** 에디터 노드에서 인용 안 문단에 `font`를 준 뒤 `docFromNode`로 꺼낸다
- **THEN** 거부된다(ProseMirror 스키마는 같은 `paragraph` 타입이라 받아들인다)

#### Scenario: attrs 없는 제목은 저장 쪽 경계에서 거부된다

- **WHEN** `attrs`가 아예 없는 제목 노드를 ProseMirror 스키마에 넣고(`level`이 `null`로 채워져 통과한다) `docFromNode`로 꺼낸다
- **THEN** 거부된다 — 필수 attrs 누락의 최종 방어선은 zod다

실패 의미론: 해당 없음 — 순수 변환(서버 상태 없음). 거부는 예외로 알린다.

### Requirement: markdown 변환 결과는 에디터를 오가도 바뀌지 않는다

content-convert `convertMarkdown`이 성공해서 내놓는 doc은 SHALL 에디터 스키마를 무손실로 지난다 — `docToNode` → `docFromNode` 결과가 변환 결과와 같다. MCP `create_draft`로 들어온 초안이 에디터에서 열리고 저장돼도 바뀌지 않는다는 보장이다(adr-013 약속, 이슈 #38). 입력 markdown은 content-schema 문서 생성기를 `serializeMarkdown`으로 쓴 것이다.

#### Scenario: 변환된 문서 표본이 에디터를 왕복한다

- **WHEN** 문서 생성기 표본을 `serializeMarkdown` → `convertMarkdown`으로 돌려 성공한 doc을 `docToNode` → `docFromNode`로 돌린다
- **THEN** 모두 변환 결과 doc과 같다
