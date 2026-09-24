## MODIFIED Requirements

### Requirement: 이미지 형식과 크기는 헤더 바이트로 판정한다

`probeImage(bytes)`는 SHALL 앞부분 바이트의 서명만으로 JPEG · PNG · WebP(VP8 · VP8L · VP8X) · GIF를 알아보고 `{ format, width, height }`를 돌려준다. PNG는 서명 뒤 첫 청크가 `IHDR`이어야 한다. JPEG는 SOF에서 크기를 기록한 뒤에도 SOS · EOI(또는 세그먼트가 끝나는 곳)까지 걸어, SOF 앞이든 뒤든 첫 EXIF(APP1) Orientation 태그가 있으면 `orientation`(1~8)도 돌려준다. EXIF는 빅 · 리틀 엔디언 모두 읽고, Exif가 아닌 APP1(XMP 등)은 건너뛰며, 깨진 IFD는 방향 없이 넘어간다. 서명이 없거나(SVG · 텍스트 · 빈 본문) 헤더가 잘렸거나 SOF 전에 세그먼트 길이가 깨졌거나 가로 · 세로가 0이면 null이며, 어떤 입력에서도 끝난다. 확장자 · Content-Type은 보지 않는다.

#### Scenario: 네 형식의 가로 · 세로를 읽는다

- **WHEN** PNG · GIF · WebP 세 종류 · JPEG 헤더를 각각 넣는다
- **THEN** 형식과 가로 · 세로가 헤더에 적힌 값이다

#### Scenario: SVG · 잘린 헤더 · 크기 0은 모른다

- **WHEN** `<svg …>` 텍스트, PNG 서명만 있고 IHDR이 잘린 바이트, 가로가 0인 GIF를 넣는다
- **THEN** 모두 null이다

#### Scenario: 깨진 JPEG · 잘린 WebP · IHDR 없는 PNG는 끝나고 null이다

- **WHEN** 길이 0인 JPEG 세그먼트(`FFD8 FFE0 0000`), SOI 뒤가 모두 `FF`인 JPEG, 크기 앞에서 잘린 SOF, 크기 필드 앞에서 잘린 VP8 · VP8L · VP8X, 12바이트가 `IHDR`이 아닌 PNG를 넣는다
- **THEN** 모두 null이다

#### Scenario: JPEG의 EXIF 방향을 읽는다

- **WHEN** Orientation 6이 든 EXIF APP1 뒤에 SOF가 있는 JPEG를 넣는다
- **THEN** `{ format: "jpeg", width, height, orientation: 6 }`이다

#### Scenario: SOF 뒤에 있는 Exif도 읽는다

- **WHEN** SOI · SOF0 · APP1(Orientation 6) · SOS 순서의 JPEG를 넣는다
- **THEN** 크기와 `orientation: 6`을 함께 돌려준다

#### Scenario: 리틀엔디언 · XMP 뒤의 Exif · 방향 1~4를 읽는다

- **WHEN** 리틀엔디언 Orientation 6, XMP APP1 뒤의 Exif APP1(6), Orientation 1 · 2 · 3 · 4인 JPEG를 넣는다
- **THEN** 각각 그 방향 값을 돌려준다

#### Scenario: 깨진 IFD는 크래시 없이 끝난다

- **WHEN** IFD 오프셋이 `0xFFFFFFFF`, 엔트리 수가 `0xFFFF`인 Exif가 든 JPEG를 넣는다
- **THEN** 둘 다 끝나고 크기를 돌려준다(오프셋이 깨진 쪽은 방향 없음)

### Requirement: 이미지 올리기는 세션이 있어야 하고 검사를 통과한 것만 저장한다 (보호 대상)

`POST /api/images`는 SHALL 세션이 없으면 401이다. 본문이 1 MiB를 넘으면 413, 형식을 모르면(SVG 포함) 415, 긴 변이 1600px을 넘거나 JPEG EXIF Orientation이 5~8(가로 · 세로가 뒤바뀌는 방향)이면 422이고 어느 경우도 저장하지 않는다. Orientation 1~4는 가로 · 세로가 그대로라 받는다. 통과하면 내용 SHA-256 앞 32자와 형식 확장자로 이름을 지어 저장하고 `{ path, naturalWidth, naturalHeight }`를 준다. 새로 쓰면 201, 같은 내용이 이미 있으면 200이다 — 둘 다 "저장됨"을 뜻하고, 같은 파일을 동시에 올리면 둘 다 201일 수 있다. `path`는 `imagePathSchema`를 통과한다.

#### Scenario: 세션 없이 올리면 401이고 저장하지 않는다

- **WHEN** 세션 쿠키 없이 PNG를 올린다
- **THEN** 401이고 저장소에 아무것도 없다

#### Scenario: PNG를 올리면 경로와 원본 크기를 받고 같은 파일은 같은 경로다

- **WHEN** 800×600 PNG를 두 번 올린다
- **THEN** 201 뒤 200이고, 두 응답의 `path`가 같으며 `imagePathSchema`를 통과하고 `naturalWidth` 800 · `naturalHeight` 600이다

#### Scenario: SVG · 큰 파일 · 긴 변 초과는 거절된다

- **WHEN** SVG, 1 MiB를 넘는 PNG, 1601×10 PNG를 각각 올린다
- **THEN** 차례로 415 · 413 · 422이고 저장소에 아무것도 없다

#### Scenario: 방향이 돌아간 JPEG는 거절된다

- **WHEN** EXIF Orientation 6인 JPEG를 Exif가 SOF 앞에 있을 때와 뒤에 있을 때 각각 올린다
- **THEN** 둘 다 422이고 저장소에 아무것도 없다

#### Scenario: 방향 1~4인 JPEG는 저장된다

- **WHEN** EXIF Orientation 1 · 2 · 3 · 4인 JPEG를 각각 올린다
- **THEN** 모두 201이다
