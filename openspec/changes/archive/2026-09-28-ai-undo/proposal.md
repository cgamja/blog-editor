# ai-undo (이슈 #186, #142에서 나눔)

## Why

AI가 MCP로 초안을 고쳤는데 망쳤을 때 한 번에 되돌릴 길이 없다. 사용자는 CLI에서 "방금 거 되돌려"라고 하거나 에디터에서 버튼 하나로 되돌리고 싶다.

## What Changes

- MCP 쓰기 도구(create_draft · update_draft)가 저장에 성공하면, 글마다 "AI 저장 직전 판"(before: 저장 전 파일 · 새로 만든 글이면 없음)과 그 저장이 만든 revision(after)을 하나 남긴다. 다음 AI 저장이 덮는다.
- MCP 도구 `revert_draft({ slug })`: 지금 revision이 after와 같을 때만(그 뒤 사람 · 다른 저장이 없을 때) before로 되돌리고 남긴 판을 지운다. 새로 만든 글(before 없음) · 발행 글 · 남긴 판 없음 · 그 뒤 바뀜은 실패로 알린다. 보호 테스트 허용 목록에 한 줄(사용자 승인 2026-09-28, adr-040).
- REST: `GET /api/posts/:slug/ai-undo`(되돌릴 수 있는지) · `POST /api/posts/:slug/ai-undo`(If-Match — 되돌리기). 계약(openapi) 갱신.
- 편집 화면 머리줄: 되돌릴 수 있을 때만 「AI 수정 되돌리기」, 누르면 확인 뒤 되돌리고 새 판을 불러온다.
- 저장소: 워크스페이스 경로 `workspaces/<id>/ai-undo/<slug>.json`(Memory · File, 계약 스위트). ADR-041.

## Impact

- 새 의존성 없음. 글 파일 · 문서 스키마 · 공개 API 그대로(남긴 판은 공개 API에 나가지 않는다).
- 하지 않는 것: 여러 단계 되돌리기 · 다시 하기, 사람 저장의 되돌리기(에디터 undo가 있다), 새로 만든 글 지우기.
