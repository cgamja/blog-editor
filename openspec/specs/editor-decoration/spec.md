# editor-decoration Specification

## Purpose

최상위 블록에 꾸미기(글꼴 · 움직임 · 폭 · 스티커)를 넣고 빼는 순수 커맨드와, 놓은 자리에서 가장 가까운 블록 기준 % 좌표를 구하는 순수 함수 — 값은 닫힌 집합(adr-008)으로만 받고, 밖이면 자르지 않고 false · null을 돌려준다.

## Requirements

### Requirement: 블록의 글꼴 · 움직임을 바꾼다

editor-core는 SHALL `setBlockFont(font | null)` · `setBlockMotion(motion | null)` 커맨드를 export한다. 선택이 걸친 최상위 블록 모두에 값을 넣고, `null`이면 지운다. 대상 중 하나라도 그 속성을 가질 수 없거나 값이 닫힌 집합 밖이면 dispatch 없이 `false`다. GapCursor · AllSelection에서도 `false`다. 모든 대상이 이미 같은 값이면 `true`를 돌려주되 dispatch하지 않는다(빈 undo 단계를 쌓지 않는다. `can`은 "이 속성을 가질 수 있나"로 남는다).

#### Scenario: 커서가 있는 최상위 문단의 글꼴이 바뀐다

- **WHEN** 문단 둘 중 첫 문단에 커서를 두고 `setBlockFont("jua")`를 실행한다
- **THEN** 첫 문단의 `font`가 `jua`이고 둘째 문단은 그대로다

#### Scenario: 여러 블록에 걸친 선택이면 모두 바뀐다

- **WHEN** 문단과 제목에 걸친 선택에서 `setBlockMotion("pop")`을 실행한다
- **THEN** 두 블록의 `motion`이 모두 `pop`이다

#### Scenario: 목록 안 커서면 바깥 목록이 바뀐다

- **WHEN** 글머리 목록 항목 안에 커서를 두고 `setBlockFont("gaegu")`를 실행한다
- **THEN** 최상위 목록의 `font`가 `gaegu`이고 안쪽 노드에는 꾸미기가 없다

#### Scenario: 이미 같은 값이면 true이지만 dispatch하지 않는다

- **WHEN** `font: "jua"` 문단에서 `setBlockFont("jua")`를, `font`가 없는 문단에서 `setBlockFont(null)`을 실행한다
- **THEN** 둘 다 `true`이고 dispatch가 한 번도 불리지 않는다

#### Scenario: null이면 꾸미기가 지워진다

- **WHEN** `font: "jua"` 문단에서 `setBlockFont(null)`을 실행한다
- **THEN** 그 문단에 `font`가 없다

#### Scenario: 가질 수 없는 속성이나 집합 밖 값은 거절한다

- **WHEN** 코드 블록에서 `setBlockFont("jua")`를, 문단에서 `setBlockFont("comic")` · `setBlockMotion("spin")`을, GapCursor · AllSelection에서 `setBlockMotion("pop")`을 실행한다
- **THEN** 모두 `false`이고 문서가 그대로다

### Requirement: 그림 · 앱 스크린샷의 폭을 바꾼다

editor-core는 SHALL `setBlockWidth(percent)` 커맨드를 export한다. 대상이 모두 `width`를 가지는 블록(그림 · 앱 스크린샷)이고 값이 `WIDTH_RANGE` 안 정수일 때만 적용한다. 노드 선택은 그대로 남는다.

#### Scenario: 선택한 그림의 폭이 바뀐다

- **WHEN** 그림을 노드 선택하고 `setBlockWidth(50)`을 실행한다
- **THEN** 그림의 `width`가 50이고 선택은 여전히 그 그림의 노드 선택이다

#### Scenario: 문단이나 범위 밖 폭은 거절한다

- **WHEN** 문단에서 `setBlockWidth(50)`을, 그림에서 `setBlockWidth(24)` · `setBlockWidth(101)` · `setBlockWidth(50.5)`를 실행한다
- **THEN** 모두 `false`이고 문서가 그대로다

### Requirement: 스티커를 넣고 고치고 지우고 옮긴다

editor-core는 SHALL `addSticker` · `updateSticker` · `removeSticker` · `moveStickerToBlock` 커맨드를 export한다. 스티커는 (최상위 블록 시작 위치, 순번)으로 가리킨다. 값은 `STICKER_IDS` · `STICKER_RANGES` 안의 정수여야 하고, 글 전체 스티커는 `MAX_STICKERS_PER_DOC`개를 넘지 않는다. 어기면 자르지 않고 `false`다.

#### Scenario: 자리를 주지 않으면 커서 블록의 기본 자리에 붙는다

- **WHEN** 문단에 커서를 두고 `addSticker("heart")`를 실행한다
- **THEN** 그 문단의 스티커가 `{ id: "heart", x: 95, y: 5, size: 15, rotate: 0 }` 하나다

#### Scenario: 자리를 주면 그 블록 그 좌표에 붙는다

- **WHEN** 둘째 블록 시작 위치와 `{ x: 10, y: 20, size: 30, rotate: -15 }`로 `addSticker("cloud", …)`를 실행한다
- **THEN** 둘째 블록 스티커 끝에 그 값이 붙는다

#### Scenario: 상한이나 닫힌 집합 밖이면 넣지 않는다

- **WHEN** 스티커가 이미 12개인 글에서 `addSticker("heart")`를, 빈 글에서 `addSticker("unicorn")` · 좌표 `x: 126` · `size: 4.5` · 최상위 블록 경계가 아닌 위치로 `addSticker`를 실행한다
- **THEN** 모두 `false`이고 문서가 그대로다

#### Scenario: 스티커 하나의 좌표만 고친다

- **WHEN** 스티커 둘이 붙은 블록에서 둘째 스티커에 `updateSticker(pos, 1, { size: 40, rotate: 30 })`을 실행한다
- **THEN** 둘째 스티커의 `size` · `rotate`만 바뀌고 첫째는 그대로다. 범위 밖 patch(`rotate: 181`)나 없는 순번은 `false`다

#### Scenario: 마지막 스티커를 지우면 스티커 자리가 비워진다

- **WHEN** 스티커 하나가 붙은 블록에서 `removeSticker(pos, 0)`을 실행한다
- **THEN** 그 블록에 `stickers`가 없다

#### Scenario: 다른 블록으로 옮기면 새 블록 기준 좌표로 붙고 회전은 유지된다

- **WHEN** 첫 블록의 `rotate: 90` 스티커를 `moveStickerToBlock(첫 블록, 0, { blockPos: 둘째 블록, x: 50, y: 50, size: 20 })`으로 옮긴다
- **THEN** 첫 블록에서 빠지고 둘째 블록 끝에 `{ x: 50, y: 50, size: 20, rotate: 90 }`으로 붙는다

#### Scenario: 되돌리기 한 번에 전으로 돌아간다

- **WHEN** 스티커를 다른 블록으로 옮긴 뒤 undo를 한 번 실행한다
- **THEN** 문서가 옮기기 전과 같다

### Requirement: 스티커 목록이 그대로면 dispatch하지 않는다

스티커 목록 커맨드(`updateSticker` · `moveStickerToBlock`의 같은 블록 경로)는 SHALL 결과 목록이 지금과 같으면 `true`를 돌려주되 dispatch하지 않는다. 빈 undo 단계를 쌓지 않는다. 글꼴 · 움직임 커맨드의 같은 값 규칙과 같다.

#### Scenario: 같은 좌표로 updateSticker를 부르면 dispatch가 없다

- **WHEN** x 10 스티커에 `updateSticker(블록, 0, { x: 10 })`을 실행한다
- **THEN** `true`이고 dispatch가 한 번도 불리지 않는다
