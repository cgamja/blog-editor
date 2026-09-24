## MODIFIED Requirements

### Requirement: 크기 · 회전 제스처는 손 위치를 허용 범위의 값으로 바꾼다

editor-react는 SHALL `resizedSize(startSize, startDistance, distance)`와 `rotatedAngle(startRotate, startRadians, radians)`를 둔다.

- 크기: 중심에서의 거리 비율만큼 바뀌고 2~50으로 모인다(스키마 `STICKER_RANGES.size`, ADR-020).
- 회전: 각도 차이만큼 바뀌고 ±180에서 감긴다. 둘 다 정수다.

#### Scenario: 거리가 두 배면 크기가 두 배, 범위 끝에서 멈춘다

- **WHEN** 크기 20에서 거리 40 → 80, 크기 30에서 거리 10 → 100, 크기 10에서 거리 50 → 1로 끈다
- **THEN** 40, 50, 2다

#### Scenario: 90도 돌리면 90, 감긴다

- **WHEN** 회전 0에서 0 → π/2 라디안, 회전 170에서 0 → π/6 라디안으로 끈다
- **THEN** 90, −160이다
