# editor-ordered-list-start Specification

## Purpose

에디터가 번호 목록 시작 번호(ordered-list-start)를 DOM으로 오가게 하고, 목록 가운데 항목을 빼내 목록이 갈려도 뒤 조각이 1부터 다시 세지 않게 한다(이슈 #80).

## Requirements

### Requirement: 에디터는 ol start를 검증해 읽고, 목록이 갈리면 번호를 잇는다

editor-core는 SHALL `<ol start>`를 docSchema와 같은 범위일 때만 start로 읽고(아니면 없음) `<ol start="n">`으로 낸다. 번호 목록(최상위 · 안쪽)에서 항목을 빼내(Enter · Shift-Tab · Backspace) 목록이 갈리면 뒤 조각의 start를 원래 번호에 이어 매긴다 — 안쪽 목록은 뒤 항목들이 빠져나온 항목 아래 목록이 된다. 첫 항목을 빼면 갈린 것이 아니라 번호를 그대로 둔다. 결과는 저장 형식(`docFromNode`)으로 읽힌다.

#### Scenario: 번호 목록 가운데 빈 항목 Enter

- **WHEN** 항목 가 · (빈 항목) · 나 · 다 번호 목록의 가운데 빈 항목에서 Enter
- **THEN** 번호 목록 가 · 문단 · start 3 번호 목록 나 · 다가 된다

#### Scenario: 이미 3부터인 목록이 갈린다

- **WHEN** start 3 번호 목록 가 · 나 · 다의 나 맨 앞에서 Backspace
- **THEN** start 3 목록 가 · 문단 나 · start 5 목록 다가 된다

#### Scenario: 번호 목록 가운데 항목 Shift-Tab

- **WHEN** 번호 목록 가 · 나 · 다의 나에서 Shift-Tab
- **THEN** 목록 가 · 문단 나 · start 3 목록 다가 된다

#### Scenario: 안쪽 번호 목록 가운데 항목 Shift-Tab

- **WHEN** 안쪽 번호 목록 가 · 나 · 다의 나에서 Shift-Tab
- **THEN** 나는 바깥 항목이 되고 그 아래 다 목록이 start 3이다

#### Scenario: 범위 밖 ol start 붙여넣기

- **WHEN** `<ol start="3">`과 `<ol start="0">`을 DOM에서 읽는다
- **THEN** 앞은 start 3, 뒤는 start가 없다
