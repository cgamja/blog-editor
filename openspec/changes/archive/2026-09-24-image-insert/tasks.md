# Tasks — image-insert (이슈 #92)

## 1. 테스트

- [x] 1.1 editor-core `plugins/image-upload.test.ts`(자리 추가 · 매핑 · 가로지른 삭제로 사라짐 · 끝내기 삽입 · 사라진 자리 결과 버림 · 실패 상태), `commands/image-alt.test.ts`(alt 바꾸기 · 한도 · 경고 장식) → verify: 빨강 · 실패 원문
- [x] 1.2 editor-react `image-insert-model.test.ts`(치수 · 품질 단계 · GIF 통과 · 응답 → attrs · 상태 → 문장 · 이미지 파일 거르기) → verify: 빨강

## 2. 구현

- [x] 2.1 content-schema `IMAGE_MAX_BYTES`, api가 사용
- [x] 2.2 editor-core 플러그인 · 커맨드 · export
- [x] 2.3 editor-react 모델 · 굽기 · 올리기 · 훅 · + 메뉴 「이미지」 · 붙여넣기 · 드롭 · 대체 텍스트 · CSS
- [x] 2.4 플레이그라운드 프록시 · dev 로그인

## 3. Converge

- [x] 3.1 로컬 API + 플레이그라운드 실브라우저(세 경로 · 실패 메시지 · 대체 텍스트) → verify: `pnpm verify` 초록
