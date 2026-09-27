## ADDED Requirements

### Requirement: 목록 항목은 할 일 체크 여부를 선택으로 가진다

`listItem`은 SHALL 선택 attrs `{ checked: boolean }`만 가진다(adr-028 3절). 값이 없으면 보통 항목, `false`면 체크하지 않은 할 일, `true`면 끝난 할 일이다. 최상위 목록 · 안쪽 목록 · 콜아웃 안 목록 어디서나 쓸 수 있다. `checked`는 구조이지 꾸미기가 아니라서 안쪽 노드에도 자리가 있다. 참/거짓이 아닌 값과 다른 키는 거부한다.

#### Scenario: 할 일 항목 체크 여부는 참/거짓만 통과한다

- **WHEN** 항목 셋(`checked: false` · `checked: true` · attrs 없음)인 점 목록과, 안쪽 목록 항목에 `checked: true`가 있는 번호 목록을 `docSchema.safeParse`하고, 이어서 `checked: "yes"`인 항목과 `attrs.done: true`인 항목을 각각 넣는다
- **THEN** 앞 두 문서는 `success === true`이고 결과가 입력과 같으며, 뒤 두 문서는 `success === false`다
