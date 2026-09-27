## ADDED Requirements

### Requirement: 할 일 항목 글자도 범위로 고치고 체크 여부는 지킨다

`editDocRange`는 SHALL 할 일 항목 문단의 글자를 다른 목록 항목 글자처럼 찾는다. 할 일 표지(`[ ]` · `[x]`)는 글자가 아니라 항목의 체크 여부라 찾는 글에 들지 않는다. 한 항목 안 글자 바꾸기는 그 항목의 `checked`를 바꾸지 않는다.

#### Scenario: 끝난 할 일 항목 글자 바꾸기

- **WHEN** 항목 `우유 사기`(`checked: true`) · `빵 사기`(`checked: false`)인 점 목록에서 `우유`를 `두유`로 바꾼다
- **THEN** 항목은 `두유 사기`(`checked: true`) · `빵 사기`(`checked: false`)다
