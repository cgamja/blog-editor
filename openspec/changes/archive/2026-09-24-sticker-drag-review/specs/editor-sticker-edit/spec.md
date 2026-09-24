## ADDED Requirements

### Requirement: 보조키가 눌린 키는 스티커 조작이 아니다

`stickerKeyCommand(ref, key, modifiers)`는 SHALL Meta · Ctrl · Alt 중 하나라도 눌렸으면 `null`을 돌려준다. 그래야 브라우저 확대(Cmd+-) · 뒤로(Cmd+[) 같은 단축키가 그대로 동작한다. 지우기 키인지는 `isStickerRemoveKey(key)`가 core 한 곳에서 정한다.

#### Scenario: Cmd · Ctrl · Alt와 함께 누른 키는 null

- **WHEN** `-`를 metaKey와, `[`를 ctrlKey와, `ArrowLeft`를 altKey와 함께 커맨드로 찾는다
- **THEN** 모두 null이다

#### Scenario: 지우기 키는 Delete와 Backspace다

- **WHEN** `isStickerRemoveKey`에 `Delete`, `Backspace`, `x`를 넣는다
- **THEN** true, true, false다

### Requirement: 스티커 개수를 문서에서 센다

editor-core는 SHALL `stickerCount(doc)`(글 전체)와 `stickersIn(doc, blockPos)`(최상위 블록 하나의 목록, 없으면 빈 배열)를 export한다. UI가 attrs를 직접 세지 않는다.

#### Scenario: 글 전체와 블록 하나의 스티커를 센다

- **WHEN** 스티커 둘인 문단과 스티커 하나인 문단이 있는 문서에서 `stickerCount`와 둘째 문단 위치의 `stickersIn`, 블록 경계가 아닌 위치의 `stickersIn`을 부른다
- **THEN** 3, 길이 1, 빈 배열이다
