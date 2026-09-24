# import-connect-recheck (PR #105 재검사)

## Why

재검사가 짚은 것 — 설정 · 미리보기의 요청 본문 크기 상한(413)과 설정 파일 strict 파싱이 동작으로는 들어갔지만 시나리오 · 테스트가 없다.

## What Changes

- workspace-settings-api: 요청 본문 크기 상한 요구사항, 틀린 설정 파일을 읽지 않는 요구사항
- import-preview-api: 요청 본문 크기 상한 요구사항

## Impact

- 테스트 추가만(동작은 앞 fix(review)에 있다)
