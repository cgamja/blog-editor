## ADDED Requirements

### Requirement: 번호 목록은 시작 번호를 선택으로 가진다

`docSchema`는 SHALL 최상위와 안쪽(목록 항목 · 콜아웃 안) `orderedList`의 `attrs.start`를 1 이상 999999999 이하 정수로만 받는다(CommonMark 번호 상한 9자리). 0 · 음수 · 소수 · 문자열 · 상한 초과는 거부한다. 안쪽 번호 목록의 attrs에는 `start`만 자리가 있다(꾸미기는 여전히 최상위만).

#### Scenario: 시작 번호가 있는 번호 목록

- **WHEN** 최상위 번호 목록 start 3과 목록 항목 안 번호 목록 start 2를 검증한다
- **THEN** 통과한다

#### Scenario: 범위 밖 시작 번호

- **WHEN** start 0 · -1 · 1.5 · "3" · 1000000000을 각각 검증한다
- **THEN** 모두 거부된다

### Requirement: 시작 번호 1은 정규형에서 지운다

`normalize(doc)`는 SHALL 번호 목록의 `start`가 1이면 지운다 — 없을 때 보이는 모양과 같다.

#### Scenario: start 1이 지워진다

- **WHEN** start 1 번호 목록을 normalize한다
- **THEN** attrs에 start가 없다

### Requirement: 시작 번호는 ol start로 렌더된다

`renderHtml`은 SHALL start가 있는 번호 목록을 `<ol start="n">`으로 낸다. 없으면 `<ol>` 그대로다.

#### Scenario: start 3 번호 목록

- **WHEN** start 3 번호 목록을 렌더한다
- **THEN** `<ol start="3">`이 나온다

### Requirement: markdown 시작 번호는 start로 오가고 0은 거부한다

`convertMarkdown`은 SHALL 첫 표지 번호가 2 이상인 번호 목록을 그 번호의 `start`로 받고, 0으로 시작하는 목록은 "순서 목록은 1 이상 번호로 시작한다" 메시지로 거부한다. `serializeMarkdown`은 번호 목록 첫 표지를 start(없으면 1)부터 쓰고, 빈 항목을 빼서 목록이 나뉘면 뒤 조각은 원래 번호를 잇는다.

#### Scenario: 3부터 시작하는 목록 왕복

- **WHEN** `3. 가` · `4. 나`를 변환하고 다시 직렬화한다
- **THEN** start 3 번호 목록이 되고 markdown은 `3. 가`로 시작한다

#### Scenario: 빈 항목에서 나뉜 번호 목록은 번호를 잇는다

- **WHEN** start 3 번호 목록 가 · (첫 문단이 빈 항목) · 다를 직렬화한다
- **THEN** `3. 가`와 `5) 다` 두 목록으로 쓴다

#### Scenario: 0으로 시작하는 목록

- **WHEN** `0. 가`를 변환한다
- **THEN** 거부되고 메시지가 하나 이상 나온다

### Requirement: 에디터는 ol start를 검증해 읽고, 목록이 갈리면 번호를 잇는다

editor-core는 SHALL `<ol start>`를 docSchema와 같은 범위일 때만 start로 읽고(아니면 없음) `<ol start="n">`으로 낸다. 최상위 번호 목록에서 항목을 빼내(Enter · Shift-Tab · Backspace) 목록이 갈리면 뒤 조각의 start를 원래 번호에 이어 매긴다. 결과는 저장 형식(`docFromNode`)으로 읽힌다.

#### Scenario: 번호 목록 가운데 빈 항목 Enter

- **WHEN** 항목 가 · (빈 항목) · 나 · 다 번호 목록의 가운데 빈 항목에서 Enter
- **THEN** 번호 목록 가 · 문단 · start 3 번호 목록 나 · 다가 된다

#### Scenario: 이미 3부터인 목록이 갈린다

- **WHEN** start 3 번호 목록 가 · 나 · 다의 나 맨 앞에서 Backspace
- **THEN** start 3 목록 가 · 문단 나 · start 5 목록 다가 된다

#### Scenario: 범위 밖 ol start 붙여넣기

- **WHEN** `<ol start="3">`과 `<ol start="0">`을 DOM에서 읽는다
- **THEN** 앞은 start 3, 뒤는 start가 없다
