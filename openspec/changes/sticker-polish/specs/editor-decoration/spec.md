## MODIFIED Requirements

### Requirement: 스티커를 넣고 고치고 지우고 옮긴다

editor-core는 SHALL `addSticker` · `updateSticker` · `removeSticker` · `moveStickerToBlock` 커맨드를 export한다. 스티커는 (최상위 블록 시작 위치, 순번)으로 가리킨다. 값은 `STICKER_IDS` · `STICKER_RANGES` 안의 정수여야 하고, 글 전체 스티커는 `MAX_STICKERS_PER_DOC`개를 넘지 않는다. 어기면 자르지 않고 `false`다. 자리를 주지 않으면 블록 오른쪽 위에 블록 폭의 8%로 붙는다(이슈 #71 — 15%는 본문 폭에서 128px라 너무 컸다).

#### Scenario: 자리를 주지 않으면 커서 블록의 기본 자리에 붙는다

- **WHEN** 문단에 커서를 두고 `addSticker("heart")`를 실행한다
- **THEN** 그 문단의 스티커가 `{ id: "heart", x: 95, y: 5, size: 8, rotate: 0 }` 하나다

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
