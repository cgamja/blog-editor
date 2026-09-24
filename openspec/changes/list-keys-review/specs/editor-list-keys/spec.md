## ADDED Requirements

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

## REMOVED Requirements

### Requirement: 최상위 목록에서 항목을 빼내도 꾸미기가 복제되거나 사라지지 않는다

**Reason**: PR #79 리뷰 — 글꼴까지 앞 조각에만 남기면 뒤 조각의 글씨체가 갑자기 바뀌어 보이고, 보정이 문서 전체를 봐서 다른 목록의 꾸미기와 헷갈렸다.

**Migration**: 「최상위 목록에서 항목을 빼내면 글꼴은 조각마다, 움직임 · 스티커는 한 곳에만 남는다」가 대신한다. 기존 두 시나리오는 그대로 옮겼다.
