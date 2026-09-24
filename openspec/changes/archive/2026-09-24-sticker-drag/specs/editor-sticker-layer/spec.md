## ADDED Requirements

### Requirement: 스티커 이름과 붙은 블록을 사람 말로 보여 준다

editor-react는 SHALL `stickerName(id)`와 `anchorLabel(nodeName)`을 둔다. 이름은 디자인 69:2의 것이다(코랄 별 · 민트 별 · 하트 · 구름 · 젖병 · 딸랑이 · 쪽쪽이 · 코랄 발자국 · 민트 발자국). 꼬리표는 「<블록>에 붙어 있어요」이고, 모르는 노드는 「블록에 붙어 있어요」다.

#### Scenario: 스티커 이름과 꼬리표

- **WHEN** `stickerName("star-coral")`, `anchorLabel("paragraph")`, `anchorLabel("image")`, `anchorLabel("mystery")`를 부른다
- **THEN** "코랄 별", "문단에 붙어 있어요", "사진에 붙어 있어요", "블록에 붙어 있어요"다

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

`BlogEditor`는 SHALL 스티커마다 포커스할 수 있는 버튼을 겹친다. 고르면 점선 테두리 · 오른쪽 아래 조절점 · 위 회전 손잡이 · 지우기 버튼 · 꼬리표를 보인다. 끌어 놓으면 트랜잭션 1번으로 옮겨지고, 놓을 수 없으면 `role=status`로 이유를 알린다. 이 요구사항은 DOM 테스트 환경이 없어(adr-019) 실브라우저 증거로 확인한다.

#### Scenario: 스티커를 끌어 다른 블록으로 옮긴다

- **WHEN** 플레이그라운드 decorationMax에서 스티커를 포인터로 끌어 다른 문단 위에 놓는다
- **THEN** 문서 JSON에서 스티커가 그 문단의 stickers로 옮겨지고 콘솔 오류가 없다
