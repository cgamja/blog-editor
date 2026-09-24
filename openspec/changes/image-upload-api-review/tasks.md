# Tasks — image-upload-api-review

## 1. 테스트

- [ ] 1.1 거부 경로 · EXIF 방향 · 받기 방어 헤더 · 저장소 경로 밖 거절 · 임시 파일 정리 시나리오 → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [ ] 2.1 fix: PNG IHDR 확인 · EXIF Orientation · 422 · CSP/CORP · 임시 파일 정리 · put contentType → verify: 1.1 초록
- [ ] 2.2 refactor: 타입 · 상수 파일 분리, 한도 문장 파생, 매직 넘버 이름, WebP 판정 분리
- [ ] 2.3 ADR-021 정정

## 3. Converge

- [ ] 3.1 로컬 서버 `curl -I`로 받기 헤더 확인 → verify: `pnpm verify` 초록
