# ordered-list-start Specification

## Purpose

번호 목록의 시작 번호(`orderedList.attrs.start`)를 문서 · 정규형 · 공개 HTML · markdown이 같은 규칙으로 다룬다(이슈 #80). 에디터 쪽 규칙은 editor-ordered-list-start.

## Requirements

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

`convertMarkdown`은 SHALL 첫 표지 번호가 2 이상인 번호 목록을 그 번호의 `start`로 받고, 0으로 시작하는 목록은 "순서 목록은 1 이상 번호로 시작한다" 메시지로 거부한다. `serializeMarkdown`은 번호 목록 첫 표지를 start(없으면 1)부터 쓰고, 빈 항목을 빼서 목록이 나뉘면 뒤 조각은 원래 번호를 잇는다. 1이 아닌 번호로 시작하는 안쪽 목록은 앞 글줄과 빈 줄로 띄운다(CommonMark: 1이 아닌 번호는 문단을 끊지 못한다).

#### Scenario: 3부터 시작하는 목록 왕복

- **WHEN** `3. 가` · `4. 나`를 변환하고 다시 직렬화한다
- **THEN** start 3 번호 목록이 되고 markdown은 `3. 가`로 시작한다

#### Scenario: 빈 항목에서 나뉜 번호 목록은 번호를 잇는다

- **WHEN** start 3 번호 목록 가 · (첫 문단이 빈 항목) · 다를 직렬화한다
- **THEN** `3. 가`와 `5) 다` 두 목록으로 쓴다

#### Scenario: 1이 아닌 안쪽 번호 목록은 빈 줄로 띄운다

- **WHEN** `1. 가` 아래 start 3 안쪽 번호 목록 나를 직렬화한다
- **THEN** `1. 가`, 빈 줄, `   3. 나`로 쓰고 다시 변환하면 같은 doc가 된다

#### Scenario: 0으로 시작하는 목록

- **WHEN** `0. 가`를 변환한다
- **THEN** 거부되고 메시지가 하나 이상 나온다
