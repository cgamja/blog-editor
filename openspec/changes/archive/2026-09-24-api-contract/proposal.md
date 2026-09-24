# api-contract (이슈 #94)

## Why

M3 web(#93)이 `/api`에 붙기 전에 계약을 한 파일로 고정한다. develop-fe API 계약 규칙(가이드 §1 상태 C — 기존 코드는 있는데 계약 원천이 없음, retrofit)에 따른다. 지금 `/api/*`는 Hono 코드와 테스트로만 정의돼 있고 `contract/`에는 공개 API 스냅샷만 있다. 계약 파일이 없으면 web이 손 타입을 쓰게 되고, 서버와 어긋나도 아무것도 깨지지 않는다.

## What Changes

- 계약 원천 `api/openapi.json`(OpenAPI 3.1)을 추가한다. 로그인 · 로그아웃, 글 목록 · 읽기 · 저장(발행은 `meta.draft: false` 저장), 이미지 올리기 · 받기, 공개 조회, 본문 CSS의 **현재 동작 그대로**다
- 백엔드가 우리 것이라 원천은 코드에서 내보낸다(가이드 §5-2). `apps/editor/api/src/contract/`의 zod 응답 스키마에서 `z.toJSONSchema`로 만들고, 내보내기 명령으로 파일을 쓴다
- 계약 테스트: ① 코드로 다시 만든 문서 = 커밋된 파일(드리프트) ② 앱에 등록된 라우트 = 계약의 경로 · 메서드 ③ 각 라우트의 실제 응답이 그 상태 코드의 계약 스키마를 통과
- 없는 엔드포인트(새 글 주소 예약 · 가져오기 미리보기 · 글쓰기 가이드 · 세션 확인 등)는 구현하지 않고 PR 본문의 계약 diff 제안으로 남긴다

## Impact

- 새 의존성 없음(zod 4 내장 `z.toJSONSchema`)
- 라우트 동작 변경 없음. 기존 보안 · 데이터 테스트는 건드리지 않는다
- `/mcp`와 OAuth 경로는 MCP 프로토콜이라 이 계약에서 뺀다(mcp-auth · mcp-oauth-* spec이 원천)
- 하지 않는 것: 클라이언트 · 타입 생성기 도입(web #93에서 LIBRARY 게이트), `.claude/cgamja.json`의 `contract` 선언(보호 파일 — web이 생성물을 쓰기 시작할 때)
