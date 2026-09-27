## ADDED Requirements

### Requirement: 블록을 바꿔도 간격은 남는다

`turnIntoTextblock`은 SHALL 글꼴 · 움직임 · 스티커처럼 간격(`space`)도 새 블록으로 옮긴다 — 사진 자리를 뺀 모든 최상위 블록에 간격 자리가 있다(adr-037).

#### Scenario: 간격 lg 문단을 제목으로

- **WHEN** `space: lg` 문단에서 `turnIntoTextblock("heading", { level: 2 })`를 부른다
- **THEN** 제목이 `level: 2`, `space: lg`를 갖는다
