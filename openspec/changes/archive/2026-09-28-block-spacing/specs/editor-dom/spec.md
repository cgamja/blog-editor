## ADDED Requirements

### Requirement: 간격은 에디터 DOM에서도 data-space다

에디터 노드의 DOM 출력은 SHALL `space`가 있으면 공개 HTML과 같은 꾸밈 래퍼에 `data-space`를 내고, 파싱 규칙은 래퍼의 `data-space`를 닫힌 집합 안일 때만 `space`로 읽는다.

#### Scenario: 간격 xl 문단 왕복

- **WHEN** `space: xl` · `font: jua` 문단을 DOM 스펙으로 냈다가 파싱 규칙으로 다시 읽는다
- **THEN** `["div", { class: "post-block", "data-font": "jua", "data-space": "xl" }, ["p", 0]]`로 나가고 `font: jua` · `space: xl`로 읽힌다
