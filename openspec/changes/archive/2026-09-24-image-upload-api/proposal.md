# image-upload-api (이슈 #82)

## Why

사용자 요청(2026-09-24): "이미지 추가가 없다." 원래 M5에 있던 이미지 올리기를 당겨 온다. 이 change는 API 쪽이다. 에디터 UI(파일 고르기 · 붙여넣기 · 끌어다 놓기 · 브라우저 줄이기)는 다음 이슈(P9)가 한다.

## What Changes

- `POST /api/images`(세션 필요): 요청 본문이 이미지 바이트다. 매직 바이트로 JPEG · PNG · WebP · GIF만 받고, 헤더에서 가로 · 세로를 읽어 긴 변 1600px 이하, 1 MiB 이하만 저장한다. 응답은 `{ path: "/images/<해시>.<확장자>", naturalWidth, naturalHeight }`
- `GET /images/:name`: 저장된 이미지를 준다(형식별 Content-Type, `nosniff`, 긴 캐시). 로컬 개발용이고 배포에서는 CloudFront가 같은 경로를 준다
- `ImageStore` 인터페이스 + 로컬 파일 구현(`<root>/images/`), 순수 함수 `probeImage`
- ADR-021: 줄이기는 브라우저, 서버는 검사 · 저장만 — 이미지 코덱 의존성 없음

## Impact

- 새 의존성 없음
- `createApp`의 선택 옵션 `images`: 없으면 두 경로가 없다(기존 테스트 · 앱 그대로)
- 하지 않는 것: 에디터 UI(P9), S3 · presigned(M4), MCP 이미지 도구, 이미지 삭제 · 목록
