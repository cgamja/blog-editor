## ADDED Requirements

### Requirement: 키 하나가 고른 스티커를 조작한다

editor-core는 SHALL `stickerKeyCommand(ref, key)`를 export한다.

- 방향키: x · y ±1
- `+` `=` / `-`: 크기 ±1
- `[` / `]`: 회전 −15 / +15. 회전은 ±180을 넘으면 반대쪽으로 감긴다
- Delete · Backspace: 그 스티커를 지운다

모르는 키면 null이다. 범위 끝에서 더 나가는 키는 커맨드가 false다.

#### Scenario: 방향키로 한 칸씩 옮긴다

- **WHEN** x 10 · y 20 스티커에 `ArrowRight`, 이어서 `ArrowUp`을 실행한다
- **THEN** x 11 · y 19다

#### Scenario: 더하기 · 빼기로 크기를 바꾼다

- **WHEN** 크기 30 스티커에 `+`, `=`, `-`를 차례로 실행한다
- **THEN** 크기가 31, 32, 31이 된다

#### Scenario: 대괄호로 15도씩 돌리고 180을 넘으면 감긴다

- **WHEN** 회전 0 스티커에 `]`, 회전 175 스티커에 `]`, 회전 −170 스티커에 `[`를 실행한다
- **THEN** 회전이 15, −170, 175다

#### Scenario: Delete와 Backspace는 지운다

- **WHEN** 스티커 둘인 블록의 첫 스티커에 `Delete`를, 다른 상태에서 `Backspace`를 실행한다
- **THEN** 두 경우 모두 그 스티커만 없다

#### Scenario: 범위 끝이면 false, 모르는 키면 null

- **WHEN** x 125 스티커에 `ArrowRight`를, 크기 50 스티커에 `+`를 실행하고 `a` 키로 커맨드를 찾는다
- **THEN** 앞의 둘은 false이고 문서가 그대로이며, `a`는 null이다

### Requirement: 고른 스티커 참조는 트랜잭션을 따라간다

editor-core는 SHALL `mapStickerRef(ref, mapping, doc)`를 export한다. 블록 시작 위치를 매핑으로 옮기고, 블록이 지워졌거나 그 순번의 스티커가 없으면 null이다.

#### Scenario: 앞 블록에 글자를 넣으면 참조가 따라간다

- **WHEN** 둘째 블록 스티커를 가리키는 참조가 있고, 첫 블록에 글자 셋을 넣는 트랜잭션을 매핑한다
- **THEN** 참조의 blockPos가 3 늘고 순번은 그대로다

#### Scenario: 블록이 지워지거나 순번이 없어지면 null

- **WHEN** 참조한 블록을 지우는 트랜잭션, 또는 순번 1을 가리키는데 스티커 하나를 지워 1개만 남는 트랜잭션을 매핑한다
- **THEN** 둘 다 null이다

### Requirement: 놓은 점은 붙을 수 있는 가장 가까운 자리에 붙는다

editor-core는 SHALL `placeStickerNear(blocks, point, stickerWidth)`를 export한다.

- 크기가 범위 안인 블록 가운데 허용 사각형(x · y −25~125%)까지의 스냅 거리가 가장 짧은 블록을 고른다. 같으면 블록까지 거리가 가까운 쪽이고, 그것도 같으면 문서에서 앞 블록이다.
- 스냅 거리가 24px 이하면 그 블록 기준 % 좌표를 돌려주고, 넘으면 null이다.

#### Scenario: 블록 안 점은 그 자리 그대로 붙는다

- **WHEN** 폭 600 · 높이 100 블록의 (300, 50)에 폭 60 스티커를 놓는다
- **THEN** 그 블록에 x 50 · y 50 · size 10이다

#### Scenario: 가까운 블록의 범위 밖이면 범위 안인 다음 블록에 붙는다

- **WHEN** 높이 20 문단 바로 아래 12px(허용 밖)에 놓고, 그 아래 높이 200 블록의 허용 범위 안이다
- **THEN** 아래 블록에 붙는다

#### Scenario: 두 블록 사이 틈이면 가까운 허용 끝으로 스냅한다

- **WHEN** 높이 20 문단 둘 사이 22px 틈의 한가운데에 놓는다
- **THEN** 위 문단의 y 125(아래 끝)에 붙는다

#### Scenario: 스냅 거리가 24px을 넘으면 놓을 수 없다

- **WHEN** 유일한 블록(높이 20) 아래로 100px 떨어진 곳에 놓는다
- **THEN** null이다

#### Scenario: 크기가 범위 밖인 블록은 건너뛴다

- **WHEN** 폭 100 블록(스티커 60px이면 60%) 안에 놓고, 그 오른쪽 120px 떨어진 곳에서 폭 600 블록이 시작한다
- **THEN** 폭 600 블록의 x −25(왼쪽 허용 끝)에 size 10으로 붙는다
