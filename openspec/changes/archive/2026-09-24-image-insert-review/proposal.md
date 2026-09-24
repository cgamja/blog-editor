# image-insert-review (PR #95 리뷰 반영)

## Why

PR #95 리뷰 2축이 이미지 넣기의 경계 · 끝 상황을 짚었다: 업로드가 끝나면 사용자가 쓰던 커서를 뺏는다, Excel · Word 붙여넣기가 그림으로 바뀐다, 문서 맨 앞 · 끝 자리가 전체 삭제 뒤에 남는다, editor-react가 서버 주소 · 인증을 안다(web의 TanStack Query 몫), 슬래시 메뉴에 「이미지」가 없다.

## What Changes

- 끝났을 때 선택이 자리를 둘 때와 같을 때만 그림을 고르고 스크롤한다
- 문서 맨 앞 · 끝 자리는 경계 아닌 쪽이 지워지면 버린다
- 붙여넣기에 글(text/plain)이나 img 하나가 아닌 HTML이 있으면 파일이 있어도 글로 둔다 — 판정 · 드롭 자리는 editor-core `imageFileInput` 플러그인
- editor-react는 `ImageUploader(blob, signal)`를 주입받는다(BlogEditor · EditorScreen `uploadImage`). 없으면 이미지 넣기 길을 열지 않는다. 응답 해석 `uploadResultFrom`만 내보낸다
- 올리기 줄: 에디터 교체 시 끊기, 한 장 예외여도 계속, 30초 시간 한도
- 슬래시 메뉴 「이미지」(`/이미지` · `/image` · `/사진`) — 「+」 메뉴와 같은 동작 항목 목록
- 굽기: 목표 크기로 바로 디코드, JPEG 대체 때 흰 바탕. 대체 텍스트 입력: Safari 조합 확정 Enter(keyCode 229) 무시

## Impact

- 새 의존성 없음
- 하지 않는 것: web의 useMutation 연결(#93 뒤), S3 presigned(M4)
