## MODIFIED Requirements

### Requirement: 끄는 동안 원래 자리의 스티커를 가리는 규칙은 순번 하나만 고른다

editor-react는 SHALL `hiddenStickerRule(index)`를 둔다. `data-sticker-hidden` 장식이 붙은 블록 바로 아래 스티커 가운데 그 순번(0부터) 하나만 `visibility: hidden`으로 가리는 CSS 규칙 문자열이다. 래퍼의 자식은 [블록 요소, …스티커]로 고정돼 있어(editor-core `withDecoration`) 순번 N의 스티커는 N+2번째 자식이다. `:nth-child(An+B of S)`는 쓰지 않는다 — 모르는 브라우저에서 규칙 전체가 버려진다.

#### Scenario: 순번 2를 가리는 규칙

- **WHEN** `hiddenStickerRule(2)`를 부른다
- **THEN** `[data-sticker-hidden="2"] > .post-sticker:nth-child(4){visibility:hidden}`이 들어 있다

### Requirement: 크기 · 회전 제스처는 손 위치를 허용 범위의 값으로 바꾼다

editor-react는 SHALL `resizedSize(startSize, startDistance, distance)`, `cornerDistance(width, height)`, `rotatedAngle(startRotate, startRadians, radians)`를 둔다.

- 크기: 기준 거리에 대한 새 거리의 비율만큼 바뀌고 5~50으로 모인다. 기준 거리는 스티커 모서리까지의 거리(`cornerDistance`)이고, 새 거리는 기준 거리에 손이 중심에서 멀어진 만큼을 더한 것이다 — 누른 점까지 거리를 기준으로 쓰면 중심 가까이를 눌렀을 때 조금만 움직여도 크기가 폭주하고, 모서리까지 거리만 쓰면 조절점 칸 안쪽을 눌렀을 때 첫 움직임에 튄다.
- 회전: 각도 차이만큼 바뀌고 ±180에서 감긴다. 둘 다 정수다.

#### Scenario: 거리가 두 배면 크기가 두 배, 범위 끝에서 멈춘다

- **WHEN** 크기 20에서 거리 40 → 80, 크기 30에서 거리 10 → 100, 크기 10에서 거리 50 → 1로 끈다
- **THEN** 40, 50, 5다

#### Scenario: 기준 거리는 모서리까지다

- **WHEN** `cornerDistance(60, 80)`을 부르고, 크기 10인 폭 60 · 높이 80 스티커를 그 거리에서 100까지 끈다
- **THEN** 50이고, 크기는 20이다

#### Scenario: 90도 돌리면 90, 감긴다

- **WHEN** 회전 0에서 0 → π/2 라디안, 회전 170에서 0 → π/6 라디안으로 끈다
- **THEN** 90, −160이다

## ADDED Requirements

### Requirement: 끌기는 Esc나 에디터 틀 밖에 놓아 취소한다

editor-react는 SHALL `isInsideLayer(point, size)`를 둔다. 스티커 옮기기는 에디터 틀(오버레이 레이어) 사각형 안에 놓을 때만 가장 가까운 허용 자리에 붙고, 밖에 놓거나 끄는 동안 Esc를 누르면 문서를 바꾸지 않고 제자리로 돌아간다(숨김도 풀린다). 스냅에 거리 한도가 없어서 취소할 길이 따로 있어야 한다.

#### Scenario: 틀 안인지 가른다

- **WHEN** 100×50 레이어에서 (−1, 10), (10, 10), (100, 50), (50, 51)을 본다
- **THEN** false, true, true, false다

#### Scenario: Esc와 틀 밖 놓기는 제자리(실브라우저)

- **WHEN** 플레이그라운드에서 스티커를 끌다가 Esc를 누르고, 다시 끌어 옆 패널 위에 놓는다
- **THEN** 두 번 다 문서가 그대로이고 원래 스티커가 다시 보이며 콘솔 오류가 없다

### Requirement: 손잡이의 누르는 칸은 스티커 크기와 상관없이 겹치지 않는다

고른 스티커의 네 모서리 조절점 · 회전 손잡이 · 지우기(×)는 SHALL 각자 44px 칸을 가지며, 스티커가 44px보다 작아도 서로 겹치지 않는다. 작은 스티커는 모서리 조절점을 바깥으로 밀고, 회전 손잡이와 ×는 조절점 줄 위에 둔다. 이 요구사항은 실브라우저에서 확인한다.

#### Scenario: 48px 스티커에서 칸마다 자기 손잡이(실브라우저)

- **WHEN** 패널에서 끌어 온 48px 스티커를 고르고 각 손잡이 가운데에서 `elementFromPoint`를 부른다
- **THEN** 여섯 점이 모두 그 자리의 손잡이를 돌려준다
