## ADDED Requirements

### Requirement: 복사해 둔 스티커를 고른 스티커 옆에 하나 더 붙인다

editor-core는 SHALL `pasteStickerBeside(copied, target)` 커맨드를 export한다. `copied`의 종류 · 크기 · 회전으로, `target`(블록 시작 위치, 순번)이 가리키는 스티커의 좌표에서 x · y를 5%씩 비켜 그 블록 스티커 끝에 하나를 더한다. 비킨 값이 범위(`STICKER_RANGES`) 밖이면 그 축은 반대쪽으로 5% 비킨다. 대상 스티커가 없거나, 글 전체가 이미 `MAX_STICKERS_PER_DOC`개이거나, 값이 닫힌 집합 밖이면 `false`이고 문서가 그대로다. 트랜잭션 하나라 되돌리기 한 번에 붙이기 전으로 돌아간다.

#### Scenario: 고른 스티커 옆에 같은 스티커가 하나 더 붙는다

- **WHEN** `{ heart, x 10, y 20, size 12, rotate 30 }` 하나가 붙은 문단에서 그 스티커를 복사해 그 스티커를 대상으로 붙인다
- **THEN** 문단 스티커가 둘이고 둘째가 `{ heart, x 15, y 25, size 12, rotate 30 }`이다

#### Scenario: 범위 끝이면 반대쪽으로 비킨다

- **WHEN** `x 125, y 10`인 스티커를 대상으로 붙인다
- **THEN** 새 스티커는 `x 120, y 15`다

#### Scenario: 글 하나 상한이면 붙이지 않는다

- **WHEN** 스티커가 12개인 글에서 붙인다
- **THEN** `false`이고 문서가 그대로다

### Requirement: 고른 스티커에서 ⌘C · ⌘V로 하나 더 만든다(실브라우저)

`BlogEditor`의 스티커 레이어는 SHALL 스티커 버튼에 포커스가 있을 때 ⌘/Ctrl+C로 그 스티커를 탭 메모리에 두고, ⌘/Ctrl+V로 지금 고른 스티커 옆에 `pasteStickerBeside`로 붙인 뒤 새 스티커를 고른다(포커스가 새 버튼으로 간다). 키는 prosemirror-keymap `keydownHandler`로 푼다 — `Mod`를 플랫폼대로 풀고, 한글 자판에서 ⌘ㅊ처럼 key가 ASCII가 아니면 keyCode로 되찾는다. 두 키는 보조키 조합이라 `stickerKeyCommand`가 null을 돌려주는 키이므로(브라우저 단축키 양보 규칙) 레이어가 그보다 먼저 받는다. 스티커 버튼에 포커스가 있는 동안 두 키는 복사해 둔 것이 없거나 가리킨 스티커가 없어도 기본 동작을 막는다 — 본문에 남은 DOM 선택을 브라우저가 복사하거나 그 자리에 붙여 넣지 않게 한다. 글 하나 상한이면 붙이지 않고 `role=status`로 상한 안내를 보인다. 한글 조합 중에는 받지 않는다. 스티커를 고르지 않은 에디터의 ⌘C · ⌘V는 그대로 글 복사 · 붙여넣기다.

#### Scenario: 스티커를 골라 ⌘C · ⌘V 하면 옆에 하나 더 생기고 새 스티커가 골라진다

- **WHEN** 스티커 둘인 문단의 하트 스티커를 고르고 ⌘/Ctrl+C, ⌘/Ctrl+V를 누른다
- **THEN** 문단 스티커가 셋이 되고, 새 하트 스티커 버튼이 눌림 상태로 포커스를 가진다
