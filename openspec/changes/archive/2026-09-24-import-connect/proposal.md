# import-connect (이슈 #98)

## Why

M3 백오피스의 남은 입구 셋 — 쓰던 마크다운 가져오기, Claude · ChatGPT 연결 안내, AI로 쓰기 — 이 없다. 가져오기는 변환 코어(content-convert)를 써야 하는데 web은 그 패키지에 닿지 못한다(adr-009 엣지). 글쓰기 가이드는 저장할 API가 없다(#94 PR의 없는 엔드포인트 제안).

## What Changes

- API(계약 먼저 — `api/openapi.json`):
  - `GET` · `PUT /api/settings` — 워크스페이스 글쓰기 가이드(쓰기 가능) · 카테고리(읽기 전용) · 연결 정보(읽기 전용). 파일 저장소는 `workspaces/<id>/settings.json`(adr-007)
  - `POST /api/import/preview` — markdown → 변환 결과(정규형 doc · 공개 렌더러 HTML · 제목/설명 제안) 또는 줄 번호 메시지. 저장하지 않는다
- MCP `get_writing_guide`가 형식 가이드 뒤에 워크스페이스 글쓰기 가이드를 붙인다 — AI가 초안 전에 읽는 안내가 화면에서 저장한 그 글이 된다
- web:
  - `features/import` — 가져오기 대화상자(결정 A: 대화상자 한 장, 원문 | 미리보기, 막는 메시지, 초안으로 만들기 → 기존 `PUT` + `If-None-Match: *`)
  - `features/connect` — `/connect` 화면(Figma 70:2)
  - `features/ai-write` — AI로 쓰기 대화상자(Figma 71:2): 프롬프트 만들기 · 복사 · 채팅 앱 새 탭 링크
- web이 `@blog-editor/content-schema`를 다시 의존한다(허용 엣지 — 초안 저장 형식 버전 · 주소 규칙)

## Impact

- 보안: MCP 도구 목록 · 발행 불가는 그대로다(보호 테스트 무변경). 설정 · 가져오기는 `/api/*` 세션 아래
- 카테고리 편집은 하지 않는다 — 카테고리는 저장 검증(발행 글 포함)의 닫힌 집합이라, 바꾸는 흐름은 기존 글 이관과 함께 따로 정한다
- 하지 않는 것: 클라이언트별 연결 상태 · 연결 끊기(API에 연결된 클라이언트 목록이 없다), 가져오기의 "빠지지만 가져오는" 손실(변환기가 모든 문제를 막는 오류로 돌려준다), 목록 버튼 · 셸 nav 연결(#96)
