## ADDED Requirements

### Requirement: 목록 항목에서 Enter로 항목을 나누고 빈 항목에서 빠져나온다

editor-core는 SHALL `listKeymap`의 Enter로 목록 항목 문단을 커서 자리에서 새 항목으로 나누고, 빈 항목 문단에서는 한 단계 내어쓴다(최상위 목록이면 목록을 빠져나와 문단이 된다). 목록 항목 밖에서는 false를 돌려 다음 Enter에 넘긴다.

#### Scenario: 글자 가운데 Enter는 항목을 나눈다

- **WHEN** 점 목록 항목 `가나`의 `가` 뒤에서 Enter
- **THEN** 항목 `가` · `나` 두 개가 되고 커서는 둘째 항목 맨 앞이다

#### Scenario: 마지막 빈 항목 Enter는 목록을 빠져나온다

- **WHEN** 점 목록의 마지막 빈 항목에서 Enter
- **THEN** 목록 뒤에 빈 최상위 문단이 생기고 커서가 그 안에 있다

#### Scenario: 안쪽 빈 항목 Enter는 바깥 목록으로 내어쓴다

- **WHEN** 안쪽 목록의 빈 항목에서 Enter
- **THEN** 그 항목이 바깥 목록의 항목이 된다

#### Scenario: 목록 밖 Enter는 넘긴다

- **WHEN** 최상위 문단에서 Enter를 `listKeymap`으로 부른다
- **THEN** false다

### Requirement: Tab · Shift-Tab으로 항목을 들여쓰고 내어쓴다

editor-core는 SHALL `listKeymap`의 Tab으로 항목을 앞 항목의 안쪽 목록으로 들여쓰고, Shift-Tab으로 한 단계 내어쓴다. 목록 항목 안이면 할 수 없어도 키를 삼키고(true), 목록 밖이면 false를 돌려 브라우저 기본(포커스 이동)을 막지 않는다.

#### Scenario: 둘째 항목 Tab은 첫 항목 안으로 들어간다

- **WHEN** 점 목록 둘째 항목에서 Tab
- **THEN** 첫 항목 안의 안쪽 점 목록 항목이 된다

#### Scenario: 첫 항목 Tab은 삼키고 문서는 그대로다

- **WHEN** 점 목록 첫 항목에서 Tab
- **THEN** true이고 문서는 그대로다

#### Scenario: 안쪽 항목 Shift-Tab은 바깥으로 나온다

- **WHEN** 안쪽 목록 항목에서 Shift-Tab
- **THEN** 바깥 목록의 항목이 된다

#### Scenario: 목록 밖 Tab은 넘긴다

- **WHEN** 최상위 문단에서 Tab
- **THEN** false다

### Requirement: 항목 맨 앞 Backspace는 내어쓴다

editor-core는 SHALL `listKeymap`의 Backspace로, 빈 선택이 항목 문단 맨 앞에 있으면 한 단계 내어쓴다. 그 밖에서는 false다.

#### Scenario: 최상위 항목 맨 앞 Backspace는 문단이 된다

- **WHEN** 한 항목짜리 점 목록 `가` 맨 앞에서 Backspace
- **THEN** 최상위 문단 `가`가 된다

#### Scenario: 글자 가운데 Backspace는 넘긴다

- **WHEN** 항목 `가나`의 `가` 뒤에서 Backspace
- **THEN** false다

### Requirement: 최상위 목록에서 항목을 빼내도 꾸미기가 복제되거나 사라지지 않는다

editor-core는 SHALL 최상위 목록에서 항목을 빼낼 때(Enter · Shift-Tab · Backspace) 목록의 스티커를 한 블록에만 남긴다. 목록이 둘로 갈리면 첫 조각에, 목록이 통째로 사라지면 빠져나온 첫 최상위 블록에 꾸미기(font · motion · stickers)를 옮긴다. 결과는 blockGuard를 통과하고 저장 형식(`docFromNode`)으로 읽힌다.

#### Scenario: 스티커 있는 목록 가운데 빈 항목 Enter

- **WHEN** 스티커 1개가 붙은 세 항목 점 목록의 가운데 빈 항목에서 Enter
- **THEN** 목록 · 문단 · 목록이 되고 문서 전체 스티커는 1개이며 첫 목록에 있다

#### Scenario: 스티커 · 글꼴 있는 한 항목 목록에서 빠져나오기

- **WHEN** font `jua`와 스티커 1개가 붙은 한 항목 점 목록 `가` 맨 앞에서 Backspace
- **THEN** 최상위 문단 `가`가 되고 그 문단이 font `jua`와 스티커 1개를 가진다
