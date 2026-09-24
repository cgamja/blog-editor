# editor-align Specification

## Purpose

문단 · 제목 · 그림 · 앱 스크린샷의 정렬(왼쪽 · 가운데 · 오른쪽, ADR-020)을 바꾸는 editor-core 커맨드와 단축키. 블록 종류의 기본 모양과 같은 값은 저장하지 않아 정규형이 하나로 남는다(이슈 #86).

## Requirements

### Requirement: 블록 정렬을 바꾼다

editor-core는 SHALL `setBlockAlign(align)` 커맨드를 export한다. 대상은 선택이 걸친 최상위 블록 전부이고, 그 블록 종류의 기본 모양(글 블록 `left`, 그림 · 앱 스크린샷 `center`)과 같은 값이면 속성을 지우고 아니면 저장한다. 한 트랜잭션이라 undo 한 번에 돌아간다.

#### Scenario: 문단을 가운데 정렬한다

- **WHEN** 문단에 커서를 두고 `setBlockAlign("center")`
- **THEN** 그 문단의 align이 `center`다

#### Scenario: 기본 모양이면 속성을 지운다

- **WHEN** 가운데 정렬 문단에 `setBlockAlign("left")`
- **THEN** 그 문단에 align이 없다

#### Scenario: 그림의 기본은 가운데다

- **WHEN** 문단과 그림에 걸친 선택에서 `setBlockAlign("left")`
- **THEN** 문단에는 align이 없고 그림의 align은 `left`다

#### Scenario: 이미 그 모양이면 dispatch하지 않는다

- **WHEN** align이 없는 그림에 `setBlockAlign("center")`
- **THEN** true이지만 dispatch가 없다

#### Scenario: 정렬 자리가 없으면 거절한다

- **WHEN** 목록 · 코드 블록 · 문단과 목록에 걸친 선택 · 집합 밖 값 · GapCursor · 전체 선택에서 `setBlockAlign`
- **THEN** false이고 문서가 그대로다

#### Scenario: 정렬을 되돌린다

- **WHEN** 문단을 오른쪽 정렬한 뒤 undo 한 번
- **THEN** 문서가 정렬 전과 같다

### Requirement: 블록의 지금 정렬을 알 수 있다

editor-core는 SHALL `alignOf(node)`를 export한다. 저장된 align이 있으면 그 값, 없으면 그 블록 종류의 기본 모양이고, 정렬 자리가 없는 블록이면 null이다.

#### Scenario: 저장값이 없으면 기본 모양이다

- **WHEN** align 없는 문단 · align 없는 그림 · 오른쪽 정렬 제목 · 목록의 `alignOf`
- **THEN** `left` · `center` · `right` · null이다

### Requirement: 정렬 단축키

editor-core는 SHALL `alignKeymap`(⌘⇧L 왼쪽 · ⌘⇧E 가운데 · ⌘⇧R 오른쪽)과 이를 싣는 `AlignKeys` 확장을 export한다. 정렬할 수 없는 곳에서도 키를 삼킨다(브라우저 새로 고침 방지).

#### Scenario: ⌘⇧E로 가운데 정렬

- **WHEN** 문단에 커서를 두고 `Mod-Shift-e` 바인딩을 실행한다
- **THEN** 그 문단의 align이 `center`다

#### Scenario: 정렬할 수 없는 곳에서도 키를 삼킨다

- **WHEN** 코드 블록에 커서를 두고 `Mod-Shift-r` 바인딩을 실행한다
- **THEN** true이고 문서가 그대로다
