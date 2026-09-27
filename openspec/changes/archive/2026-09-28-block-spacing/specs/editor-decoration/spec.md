## ADDED Requirements

### Requirement: 블록 간격을 바꾼다

`setBlockSpace(space)`는 SHALL 선택이 걸친 최상위 블록 전부의 `space`를 바꾼다. `null`이면 지운다(보통). 집합 밖 값이면 어떤 상태에서도 dispatch 없이 false다. 사진 자리를 뺀 모든 최상위 블록에 자리가 있다. 블록을 나누면(Enter) 간격은 원래(앞) 블록에만 남는다(adr-037).

#### Scenario: 걸친 선택 · 지우기 · 집합 밖

- **WHEN** 문단 · 그림에 걸친 선택에서 `setBlockSpace("lg")`, `space: xl` 그림을 노드로 고르고 `setBlockSpace(null)`, 문단에서 `setBlockSpace("12px")` · `setBlockSpace("md")`를 부른다
- **THEN** 두 블록에 `space: lg`가 붙고, 그림의 `space`는 지워지고, 집합 밖 값은 false다
