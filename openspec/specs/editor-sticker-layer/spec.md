# editor-sticker-layer Specification

## Purpose

에디터 위 스티커 오버레이(editor-react) — 스티커를 고르고 끌어 옮기고 크기 · 회전을 바꾸고 지운다. 포인터 손잡이마다 키보드 대체가 있고, 패널 격자에서 끌어 온 스티커를 받는다(이슈 #61 결정 B안).

## Requirements

### Requirement: 크기 · 회전 제스처는 손 위치를 허용 범위의 값으로 바꾼다

editor-react는 SHALL `resizedSize(startSize, startDistance, distance)`와 `rotatedAngle(startRotate, startRadians, radians)`를 둔다.

- 크기: 중심에서의 거리 비율만큼 바뀌고 5~50으로 모인다.
- 회전: 각도 차이만큼 바뀌고 ±180에서 감긴다. 둘 다 정수다.

#### Scenario: 거리가 두 배면 크기가 두 배, 범위 끝에서 멈춘다

- **WHEN** 크기 20에서 거리 40 → 80, 크기 30에서 거리 10 → 100, 크기 10에서 거리 50 → 1로 끈다
- **THEN** 40, 50, 5다

#### Scenario: 90도 돌리면 90, 감긴다

- **WHEN** 회전 0에서 0 → π/2 라디안, 회전 170에서 0 → π/6 라디안으로 끈다
- **THEN** 90, −160이다

### Requirement: 패널에서 끌어 오는 스티커는 정해진 형식으로 싣는다

editor-react는 SHALL `writeStickerDrag(dataTransfer, id)`와 `readStickerDrag(dataTransfer)`를 둔다. MIME은 `application/x-blog-editor-sticker`이고, 읽을 때 `STICKER_IDS` 밖이거나 형식이 없으면 null이다.

#### Scenario: 쓴 것을 그대로 읽고 모르는 id는 거절한다

- **WHEN** `writeStickerDrag(dt, "heart")` 뒤 `readStickerDrag(dt)`, 같은 MIME에 `"unicorn"`을 넣은 dt, 형식이 없는 dt를 읽는다
- **THEN** "heart", null, null이다

### Requirement: 에디터 위에서 스티커를 고르고 옮긴다(실브라우저)

`BlogEditor`는 SHALL 스티커마다 포커스할 수 있는 버튼을 겹친다. 고르면 점선 테두리 · 네 모서리 크기 조절점 · 위 회전 손잡이 · 지우기 버튼을 보인다(「~에 붙어 있어요」 꼬리표는 없다 — 이슈 #71). 옮기기는 `grab`, 끄는 중에는 `grabbing` 커서이고, 조절점은 화면 방향의 크기 커서, 회전 손잡이는 회전 커서다. 끄는 동안 원래 자리의 스티커는 숨고 불투명한 유령이 포인터를 따라온다. 놓으면 트랜잭션 1번으로 옮겨지고, 놓을 수 없으면 `role=status`로 이유를 알린다. 이 요구사항은 DOM 테스트 환경이 없어(adr-019) 실브라우저 증거로 확인한다.

#### Scenario: 스티커를 끌어 다른 블록으로 옮긴다

- **WHEN** 플레이그라운드 decorationMax에서 스티커를 포인터로 끌어 다른 문단 위에 놓는다
- **THEN** 문서 JSON에서 스티커가 그 문단의 stickers로 옮겨지고 콘솔 오류가 없다

### Requirement: 스티커 이름을 사람 말로 보여 준다

editor-react는 SHALL `stickerName(id)`를 둔다. 이름은 디자인 69:2의 것이다(코랄 별 · 민트 별 · 하트 · 구름 · 젖병 · 딸랑이 · 쪽쪽이 · 코랄 발자국 · 민트 발자국). 모르는 id는 그대로 돌려준다.

#### Scenario: 스티커 이름

- **WHEN** `stickerName("star-coral")`, `stickerName("foot-mint")`, `stickerName("unicorn")`을 부른다
- **THEN** "코랄 별", "민트 발자국", "unicorn"이다

### Requirement: 크기 조절점의 커서는 화면에서 보이는 방향을 따른다

editor-react는 SHALL `resizeCursor(corner, rotate)`를 둔다. 네 모서리(`nw` · `ne` · `se` · `sw`) 조절점은 스티커와 함께 돌기 때문에, 커서는 모서리의 기본 방향에 회전을 더한 화면 각도에 가장 가까운 CSS 크기 커서(`ew-resize` · `nwse-resize` · `ns-resize` · `nesw-resize`)다.

#### Scenario: 회전이 없으면 모서리 그대로, 45도 돌면 한 칸씩 돈다

- **WHEN** `resizeCursor("se", 0)`, `resizeCursor("ne", 0)`, `resizeCursor("se", 45)`, `resizeCursor("se", 90)`, `resizeCursor("nw", -45)`를 부른다
- **THEN** `nwse-resize`, `nesw-resize`, `ns-resize`, `nesw-resize`, `ew-resize`다

### Requirement: 끄는 동안 원래 자리의 스티커를 가리는 규칙은 순번 하나만 고른다

editor-react는 SHALL `hiddenStickerRule(index)`를 둔다. `data-sticker-hidden` 장식이 붙은 블록 바로 아래 `.post-sticker` 가운데 그 순번(0부터) 하나만 `visibility: hidden`으로 가리는 CSS 규칙 문자열이다.

#### Scenario: 순번 2를 가리는 규칙

- **WHEN** `hiddenStickerRule(2)`를 부른다
- **THEN** `[data-sticker-hidden="2"] > :nth-child(3 of .post-sticker){visibility:hidden}`이 들어 있다
