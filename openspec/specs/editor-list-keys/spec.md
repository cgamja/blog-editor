# editor-list-keys Specification

## Purpose

점 · 번호 목록에서 Enter(항목 나누기 · 빈 항목 빠져나오기) · Tab · Shift-Tab(들여쓰기 · 내어쓰기) · 항목 맨 앞 Backspace(내어쓰기)를 prosemirror-schema-list로 싣는다. 최상위 목록에서 항목을 빼내도 꾸미기는 한 블록에만 남는다(이슈 #78).

## Requirements

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

### Requirement: 목록 바로 뒤 문단 맨 앞 Backspace는 앞 목록에 글자를 합친다

editor-core는 SHALL `listKeymap`의 Backspace로, 빈 선택이 앞 형제가 목록인 최상위 문단 맨 앞에 있으면 그 문단 글자를 앞 목록의 마지막 텍스트 블록 끝에 합치고 커서를 합친 자리에 둔다. 문단을 목록 항목으로 다시 감싸지 않는다 — 항목 맨 앞 Backspace(내어쓰기)와 핑퐁이 되지 않는다. 꾸미기가 있는 문단은 꾸미기를 잃지 않게 false로 넘긴다.

#### Scenario: 목록 뒤 문단을 합친다

- **WHEN** 목록 바로 뒤 문단 나 맨 앞에서 Backspace
- **THEN** 앞 목록 마지막 항목 끝에 글자가 합쳐진다

#### Scenario: 항목 맨 앞 Backspace 두 번

- **WHEN** 점 목록 가 · 나의 나 맨 앞에서 Backspace 두 번
- **THEN** 한 항목 가나가 된다

### Requirement: 최상위 목록에서 항목을 빼내면 글꼴은 조각마다, 움직임 · 스티커는 한 곳에만 남는다

editor-core는 SHALL 최상위 목록에서 항목을 빼낼 때(Enter · Shift-Tab · Backspace) 원래 목록이 차지하던 자리의 최상위 블록만 보고 꾸미기를 보정한다. 목록이 둘로 갈리면 글꼴은 두 조각 모두 두고 움직임 · 스티커는 앞 조각에만 남긴다. 목록이 통째로 사라지면 빠져나온 첫 최상위 블록에 꾸미기(font · motion · stickers)를 옮긴다. 결과는 blockGuard를 통과하고 저장 형식(`docFromNode`)으로 읽힌다.

#### Scenario: 스티커 있는 목록 가운데 빈 항목 Enter

- **WHEN** 스티커 1개가 붙은 세 항목 점 목록의 가운데 빈 항목에서 Enter
- **THEN** 목록 · 문단 · 목록이 되고 문서 전체 스티커는 1개이며 첫 목록에 있다

#### Scenario: 스티커 · 글꼴 있는 한 항목 목록에서 빠져나오기

- **WHEN** font `jua`와 스티커 1개가 붙은 한 항목 점 목록 `가` 맨 앞에서 Backspace
- **THEN** 최상위 문단 `가`가 되고 그 문단이 font `jua`와 스티커 1개를 가진다

#### Scenario: 같은 글꼴 목록이 앞에 또 있다

- **WHEN** 같은 글꼴 목록이 앞에 또 있을 때 뒤 한 항목 목록 나 맨 앞에서 Backspace
- **THEN** 빠져나온 문단이 글꼴을 가진다

#### Scenario: 같은 스티커 문단이 앞에 있다

- **WHEN** 같은 스티커 문단이 앞에 있을 때 스티커 목록 가운데 빈 항목에서 Enter
- **THEN** 앞 문단과 첫 목록 조각이 스티커를 가진다

#### Scenario: 글꼴은 두 조각 모두

- **WHEN** 글꼴 · 움직임 · 스티커 목록 가운데 빈 항목에서 Enter
- **THEN** 글꼴은 두 조각 모두, 움직임 · 스티커는 앞 조각에만 남는다

#### Scenario: 스티커 12개 목록

- **WHEN** 스티커 12개 목록 가운데 빈 항목에서 Enter
- **THEN** 나뉘고 문서 스티커는 12개이며 저장 형식으로 읽힌다

#### Scenario: 첫 항목 Shift-Tab

- **WHEN** 스티커 목록 첫 항목에서 Shift-Tab
- **THEN** 문단이 되고 남은 목록이 스티커를 그대로 가진다

#### Scenario: 안쪽 목록이 달린 한 항목

- **WHEN** 안쪽 목록이 달린 한 항목 글꼴 목록 맨 앞에서 Backspace
- **THEN** 빠져나온 문단이 글꼴을 갖고 저장 형식으로 읽힌다
