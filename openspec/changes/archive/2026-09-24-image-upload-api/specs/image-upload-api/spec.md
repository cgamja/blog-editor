## ADDED Requirements

### Requirement: 이미지 형식과 크기는 헤더 바이트로 판정한다

`probeImage(bytes)`는 SHALL 앞부분 바이트의 서명만으로 JPEG · PNG · WebP(VP8 · VP8L · VP8X) · GIF를 알아보고 `{ format, width, height }`를 돌려준다. 서명이 없거나(SVG · 텍스트 · 빈 본문) 헤더가 잘렸거나 가로 · 세로가 0이면 null이다. 확장자 · Content-Type은 보지 않는다.

#### Scenario: 네 형식의 가로 · 세로를 읽는다

- **WHEN** PNG · GIF · WebP 세 종류 · JPEG 헤더를 각각 넣는다
- **THEN** 형식과 가로 · 세로가 헤더에 적힌 값이다

#### Scenario: SVG · 잘린 헤더 · 크기 0은 모른다

- **WHEN** `<svg …>` 텍스트, PNG 서명만 있고 IHDR이 잘린 바이트, 가로가 0인 GIF를 넣는다
- **THEN** 모두 null이다

### Requirement: 이미지 올리기는 세션이 있어야 하고 검사를 통과한 것만 저장한다 (보호 대상)

`POST /api/images`는 SHALL 세션이 없으면 401이다. 본문이 1 MiB를 넘으면 413, 형식을 모르면(SVG 포함) 415, 긴 변이 1600px을 넘으면 422이고 어느 경우도 저장하지 않는다. 통과하면 내용 SHA-256 앞 32자와 형식 확장자로 이름을 지어 저장하고 `{ path, naturalWidth, naturalHeight }`를 준다. 새로 쓰면 201, 같은 내용이 이미 있으면 200이다. `path`는 `imagePathSchema`를 통과한다.

#### Scenario: 세션 없이 올리면 401이고 저장하지 않는다

- **WHEN** 세션 쿠키 없이 PNG를 올린다
- **THEN** 401이고 저장소에 아무것도 없다

#### Scenario: PNG를 올리면 경로와 원본 크기를 받고 같은 파일은 같은 경로다

- **WHEN** 800×600 PNG를 두 번 올린다
- **THEN** 201 뒤 200이고, 두 응답의 `path`가 같으며 `imagePathSchema`를 통과하고 `naturalWidth` 800 · `naturalHeight` 600이다

#### Scenario: SVG · 큰 파일 · 긴 변 초과는 거절된다

- **WHEN** SVG, 1 MiB를 넘는 PNG, 1601×10 PNG를 각각 올린다
- **THEN** 차례로 415 · 413 · 422이고 저장소에 아무것도 없다

### Requirement: 저장된 이미지는 형식에 맞는 Content-Type과 nosniff로 준다

`GET /images/:name`은 SHALL 이름이 `<해시 32자>.<jpg|png|webp|gif>` 모양이 아니거나 없는 이미지면 404다. 있으면 200과 원래 바이트, 확장자에 맞는 `Content-Type`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`을 준다.

#### Scenario: 올린 이미지를 받아 온다

- **WHEN** PNG를 올리고 받은 `path`로 GET한다
- **THEN** 200, 같은 바이트, `image/png`, nosniff, immutable 캐시다

#### Scenario: 모양이 아닌 이름 · 없는 이미지는 404다

- **WHEN** `/images/..%2Fsecret.png`, `/images/abc.svg`, 올린 적 없는 해시 이름을 GET한다
- **THEN** 모두 404다

실패 의미론: 검사가 모두 끝난 뒤에만 저장한다 — 거절된 요청은 저장소를 바꾸지 않는다. 쓰기는 임시 파일 → rename이라 중간에 멈춰도 반쯤 쓴 이미지가 남지 않는다.
