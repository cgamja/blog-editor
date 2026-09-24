# Tasks — image-upload-api (이슈 #82)

## 1. 테스트

- [x] 1.1 `api/src/image-probe.test.ts`(네 형식 · SVG · 잘림 · 0), `api/src/images.test.ts`(401 · 201/200 · 415/413/422 · GET · 404), 헤더 바이트 생성은 `images.test.helpers.ts` → verify: 빨강 · 실패 원문 보고

## 2. 구현

- [x] 2.1 `image-probe.ts` · `image-store.ts` · `file-image-store.ts` · `images.ts`(경로 등록) · `app.ts` 옵션 · `serve.ts` 연결 · `messages.ts` → verify: 1.1 초록
- [x] 2.2 ADR-021

## 3. Converge

- [x] 3.1 로컬 서버에서 curl로 올리기 · 받기 확인 → verify: `pnpm verify` 초록
