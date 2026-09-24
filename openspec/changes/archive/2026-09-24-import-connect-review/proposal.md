# import-connect-review (이슈 #98 · PR #105 리뷰)

## Why

PR #105 리뷰 2축이 찾은 것 — 스펙에 없던 동작(제안 제목 80자 자르기), 옛 요구사항 꼬리 문장("설정 API가 생기면 합친다")과 새 요구사항의 모순, 세션 없는 설정 저장 · 미리보기의 401 확인, 409 정규화, 가져올 파일 거르기.

## What Changes

- mcp-drafts: 읽기 도구 요구사항에서 "설정 API가 생기면 합친다"를 지우고 새 가이드 요구사항을 가리킨다
- import-preview-api: 제안은 제목 80자 · 설명 160자까지(UTF-16 길이, 서로게이트 쌍을 가르지 않는다), 세션 없으면 401, 요청 본문 크기 상한
- workspace-settings-api: 세션 없는 저장은 401이고 가이드가 그대로다, 요청 본문 크기 상한
- web-app: API 요청 도우미가 409를 `ConflictError`로 정규화한다
- web-import: `.md` · `.markdown` 이고 크기 상한 안인 파일만 읽는다

## Impact

- 테스트 추가만 — 기존 assertion은 바꾸지 않는다
- 하지 않는 것: `PUT /api/posts`의 요청 본문 크기 상한(같은 빈틈, 후속)
