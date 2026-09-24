## ADDED Requirements

### Requirement: 스티커 목록이 그대로면 dispatch하지 않는다

스티커 목록 커맨드(`updateSticker` · `moveStickerToBlock`의 같은 블록 경로)는 SHALL 결과 목록이 지금과 같으면 `true`를 돌려주되 dispatch하지 않는다. 빈 undo 단계를 쌓지 않는다. 글꼴 · 움직임 커맨드의 같은 값 규칙과 같다.

#### Scenario: 같은 좌표로 updateSticker를 부르면 dispatch가 없다

- **WHEN** x 10 스티커에 `updateSticker(블록, 0, { x: 10 })`을 실행한다
- **THEN** `true`이고 dispatch가 한 번도 불리지 않는다

## REMOVED Requirements

### Requirement: 놓은 자리에서 가장 가까운 블록과 % 좌표를 구한다

**Reason**: 가장 가까운 블록 하나만 보면 문단 사이 틈에 놓았을 때 대부분 null이 된다(sticker-drag design.md 3). 운영 코드는 `placeStickerNear`(editor-sticker-edit)만 쓴다.

**Migration**: `placeStickerNear(blocks, point, stickerWidth)`를 쓴다. 좌표 정의(중심 %, 폭 기준 크기)는 같다.
