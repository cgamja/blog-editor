---
paths: ["**/*.test.*", "e2e/**"]
---

# 테스트

각 항목 끝 대괄호는 그 규칙을 **무엇이 강제하는가**다(플러그인 adr/0031). `[없음]`도 유효한 답이다 — 수단이 없다는 사실이 보이는 것이 목적.

- 순수 함수 층(스키마 · 변환 · 렌더 · 커맨드 · API 핸들러)은 Vitest node 환경, DOM 없이(vitest.config.ts) **[tests.layers.unit]**
- 에디터 동작(선택 영역 · IME · NodeView · 두 탭 409)은 실브라우저 층(plan 05) — 아직 없다. 그동안은 수동 체크리스트를 PR에 적는다 **[없음 — tests.layers.browser 미선언]**
- spec의 `#### Scenario` 1개 = 테스트 1개. 이름은 "WHEN … THEN …" **[사람 — 리뷰 2축]**
- 먼저 실패를 보여준다: 실패 출력 원문 + 이유("기능 미구현"). import 오류 · 오타는 red가 아니다. 첫 테스트 편집은 세션당 1회 사람 승인 **[tests.patterns]**
- 테스트 커밋(`test:`)과 구현 커밋 분리. feat/fix 커밋에 테스트 파일이 섞이면 거부된다 **[lefthook commit-msg]**
- 테스트 지원 파일(헬퍼 · 가짜 객체)은 `<이름>.test.helpers.ts` — red 게이트 · 커밋 분리가 테스트로 보고, vitest는 실행하지 않는다 **[tests.patterns · lefthook · eslint TEST_SUPPORT_FILES]**
- 보안·데이터 테스트(공개 API에 초안 없음 · 409 · URL 스킴 허용 목록 · MCP 토큰으로 발행 불가)는 고쳐서 통과시키지 않는다 **[사람 — 리뷰 2축 + PR 체크리스트]**
- mock은 네트워크 경계에서만. 자식 모듈 · store mock 금지. PostStore는 Memory 구현(계약 스위트 공유) **[없음 — mock.boundary 미선언, web 생기면 msw]**
- skip/only/`expect(true)`/빈 assertion 금지 **[없음]**
- 상세 루프와 예시: cgamja 플러그인 `skills/test-driven-development/` **[사람]**
