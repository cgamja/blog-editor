# image-upload-api-review (PR #83 리뷰 반영)

## Why

PR #83 리뷰 2축에서 나온 것을 반영한다. 거부 경로(깨진 JPEG · 잘린 WebP)가 테스트로 고정되지 않았고, 받기 응답의 방어가 한 겹뿐이며, EXIF 방향이 돌아간 JPEG는 가로 · 세로가 뒤바뀐 크기로 저장될 수 있었다. 저장소 쪽도 경로 밖 쓰기 거절과 임시 파일 정리가 스펙에 없었다.

## What Changes

- `probeImage`: PNG는 12바이트에 `IHDR`이 있어야 한다. JPEG는 EXIF APP1의 Orientation 태그를 함께 읽는다
- `POST /api/images`: JPEG Orientation이 5~8(가로 · 세로가 뒤바뀌는 방향)이면 422
- `GET /images/*`: `Content-Security-Policy: default-src 'none'; sandbox` · `Cross-Origin-Resource-Policy: same-site` 추가
- `ImageStore.put(name, bytes, contentType)` — 구현(S3 · CloudFront 포함)이 응답에 붙일 헤더 계약을 JSDoc에
- 파일 저장소: 쓰기 · rename이 실패하면 임시 파일을 지운다
- 스펙: 동시에 같은 파일을 올리면 둘 다 201일 수 있다(둘 다 "저장됨")

## Impact

- 새 의존성 없음. ADR-021 문장 정정(LIBRARY 게이트 인용 · EXIF 전제 · 저장소 헤더 계약)
