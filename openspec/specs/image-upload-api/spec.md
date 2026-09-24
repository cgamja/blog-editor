# image-upload-api Specification

## Purpose

이미지 올리기 · 받기 API(plan 3-8 · ADR-021) — 서버는 줄이지 않고 헤더 바이트로 형식 · 크기만 검사한 뒤 내용 해시 이름으로 저장한다. 줄이기는 브라우저가 한다. 로컬 개발은 서버 경유 업로드와 `GET /images/*` 제공, 배포(M4)는 presigned 직접 업로드와 CloudFront로 바뀐다.

## Requirements

### Requirement: 이미지 형식과 크기는 헤더 바이트로 판정한다

`probeImage(bytes)`는 SHALL 앞부분 바이트의 서명만으로 JPEG · PNG · WebP(VP8 · VP8L · VP8X) · GIF를 알아보고 `{ format, width, height }`를 돌려준다. PNG는 서명 뒤 첫 청크가 `IHDR`이어야 한다. JPEG에 EXIF(APP1) Orientation 태그가 있으면 `orientation`(1~8)도 돌려준다. 서명이 없거나(SVG · 텍스트 · 빈 본문) 헤더가 잘렸거나 세그먼트 길이가 깨졌거나 가로 · 세로가 0이면 null이며, 어떤 입력에서도 끝난다. 확장자 · Content-Type은 보지 않는다.

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

### Requirement: 이미지 올리기는 세션이 있어야 하고 검사를 통과한 것만 저장한다 (보호 대상)

`POST /api/images`는 SHALL 세션이 없으면 401이다. 본문이 1 MiB를 넘으면 413, 형식을 모르면(SVG 포함) 415, 긴 변이 1600px을 넘거나 JPEG EXIF Orientation이 5~8(가로 · 세로가 뒤바뀌는 방향)이면 422이고 어느 경우도 저장하지 않는다. 통과하면 내용 SHA-256 앞 32자와 형식 확장자로 이름을 지어 저장하고 `{ path, naturalWidth, naturalHeight }`를 준다. 새로 쓰면 201, 같은 내용이 이미 있으면 200이다 — 둘 다 "저장됨"을 뜻하고, 같은 파일을 동시에 올리면 둘 다 201일 수 있다. `path`는 `imagePathSchema`를 통과한다.

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

- **WHEN** EXIF Orientation 6인 JPEG를 올린다
- **THEN** 422이고 저장소에 아무것도 없다

### Requirement: 저장된 이미지는 형식에 맞는 Content-Type과 nosniff로 준다

`GET /images/:name`은 SHALL 이름이 `<해시 32자>.<jpg|png|webp|gif>` 모양이 아니거나 없는 이미지면 404다. 있으면 200과 원래 바이트, 확장자에 맞는 `Content-Type`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-site`, `Cache-Control: public, max-age=31536000, immutable`을 준다.

#### Scenario: 올린 이미지를 받아 온다

- **WHEN** PNG를 올리고 받은 `path`로 GET한다
- **THEN** 200, 같은 바이트, `image/png`, nosniff, CSP `default-src 'none'; sandbox`, CORP `same-site`, immutable 캐시다

#### Scenario: 모양이 아닌 이름 · 없는 이미지는 404다

- **WHEN** `/images/..%2Fsecret.png`, `/images/abc.svg`, 올린 적 없는 해시 이름을 GET한다
- **THEN** 모두 404다

### Requirement: 파일 이미지 저장소는 경로 밖에 쓰지 않고 실패하면 임시 파일을 남기지 않는다 (보호 대상)

`createFileImageStore`는 SHALL 이름 모양(`<해시 32자>.<jpg|png|webp|gif>`)이 아니면 쓰기를 거절하고 읽기는 null을 준다 — 라우트가 이미 걸러도 저장소가 다시 확인한다. 쓰기는 임시 파일 → rename이고, 쓰기나 rename이 실패하면 임시 파일을 지운 뒤 오류를 그대로 던진다.

#### Scenario: 이름 모양의 이미지를 쓰고 읽는다

- **WHEN** 이름 모양의 이미지를 쓰고 읽는다
- **THEN** 같은 바이트가 `<root>/images`에 있다

#### Scenario: 경로 밖으로 나가는 이름은 거절된다

- **WHEN** `../escape.png`로 쓰고 읽는다
- **THEN** 쓰기는 오류, 읽기는 null이고 파일이 생기지 않는다

#### Scenario: rename이 실패하면 임시 파일이 남지 않는다

- **WHEN** 같은 이름의 디렉터리가 이미 있어 rename이 실패한다
- **THEN** 쓰기는 오류이고 `<root>/images`에 `.tmp` 파일이 없다
