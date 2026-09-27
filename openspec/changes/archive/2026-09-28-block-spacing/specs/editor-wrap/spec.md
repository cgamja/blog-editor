## ADDED Requirements

### Requirement: 감싸면 간격은 바깥 블록으로 옮기고 정렬은 지운다

최상위 블록을 목록 · 번호 목록 · 인용 · 콜아웃으로 감싸면 SHALL 간격(`space`)을 다른 꾸밈처럼 새 바깥 블록으로 옮기고(값이 있는 첫 블록의 것), 감싸는 노드에 자리가 없는 정렬(`align`)은 안쪽 블록에서 지운다. 안쪽에 남아 닫힌 집합 밖이 되어 감싸기가 거부되지 않는다.

#### Scenario: 간격 lg 문단 감싸기

- **WHEN** `space: lg` 문단을 `wrapInBulletList` · `wrapInOrderedList` · `wrapInBlockquote` · `wrapInCallout("tip")`으로 감싼다
- **THEN** 문서가 바뀌고 바깥 블록이 `space: lg`를 갖는다

#### Scenario: 가운데 정렬 문단을 목록으로

- **WHEN** `align: center` 문단을 `wrapInBulletList`로 감싼다
- **THEN** 문서가 바뀌고 목록 · 안쪽 문단 어디에도 `align`이 없다
