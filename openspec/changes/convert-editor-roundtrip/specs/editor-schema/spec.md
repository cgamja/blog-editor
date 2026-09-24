## ADDED Requirements

### Requirement: markdown 변환 결과는 에디터를 오가도 바뀌지 않는다

content-convert `convertMarkdown`이 성공해서 내놓는 doc은 SHALL 에디터 스키마를 무손실로 지난다 — `docToNode` → `docFromNode` 결과가 변환 결과와 같다. MCP `create_draft`로 들어온 초안이 에디터에서 열리고 저장돼도 바뀌지 않는다는 보장이다(adr-013 약속, 이슈 #38). 입력 markdown은 content-schema 문서 생성기를 `serializeMarkdown`으로 쓴 것이다.

#### Scenario: 변환된 문서 표본이 에디터를 왕복한다

- **WHEN** 문서 생성기 표본을 `serializeMarkdown` → `convertMarkdown`으로 돌려 성공한 doc을 `docToNode` → `docFromNode`로 돌린다
- **THEN** 모두 변환 결과 doc과 같다
