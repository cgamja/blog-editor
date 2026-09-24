# conventions — 이유와 예시

규칙 자체는 `.claude/rules/`와 린트에 있다. 여기는 "왜"와 정본 포인터만. `@`로 CLAUDE.md에 불러오지 않는다. 규칙을 여기에 추가로 쓰지 않는다 — 린트나 `.claude/rules/`에 쓰고 여기엔 이유만. 철학 원문은 https://github.com/cgamja/cgamja-philosophy/tree/main/docs.

## 패키지 경계

- 왜 상대경로까지 막나: `@blog-editor/<name>`만 막으면 `../../content-render/src/…`로 우회된다. 세팅 프로브에서 실제로 통과됐다(2026-09-22, adr-009). 정본: `eslint.config.mjs` + `eslint.boundaries.test.ts`(막는 모양을 열거한다)
- 왜 content-schema가 ProseMirror를 모르나: 저장 형식의 주인은 에디터 라이브러리가 아니다(adr-002 · adr-003)

## web 폴더 층

- `apps/editor/web/src` 최상위는 `app` · `features` · `shared` · `styles`뿐이다. 의존은 app → features → shared 한 방향
  - `features/<이름>/` — 기능 하나(auth · posts …)의 api · hooks · components · **pages** · constants · types. 밖에서는 `features/<이름>`(index.ts)만 import한다
  - `app/` — 여러 기능을 조합하는 곳: 라우터 · QueryClient · 앱 틀(`app/layout`) · 기능에 속하지 않는 화면(`app/pages`: 404 · 오류 · 자리 표시)
  - `shared/` — 기능을 모르는 것: 요청 도우미 · 경로 상수 · 공통 문장
- 왜 최상위 `pages/`를 두지 않나: 화면 폴더가 층 밖에 있으면 어느 방향으로 import해도 되는지 규칙이 걸리지 않는다(#96 사용자 결정). 기능의 화면은 그 기능 안에, 조합은 app에 둔다
- 정본: `eslint.config.mjs`의 web 층 블록 + `eslint.boundaries.test.ts`(막는 모양과 최상위 폴더 목록을 열거한다)

## 상태 위치

- 문서 상태는 EditorState 하나(adr-006). 복제 store는 "같은 진실 두 곳"을 만든다 — 에이전트 코드베이스의 실증된 실패 2위
- 서버 상태는 TanStack Query. 409와 목록 무효화가 주 용도

## 테스트 / 커밋

- TDD는 품질 기법이 아니라 **리뷰 게이트 + 변조 방지**: 실패 테스트를 사람이 보고 커밋한 뒤 구현. 테스트 커밋과 구현 커밋을 분리하면 테스트 약화가 diff에 보인다
- 테스트 지원 파일을 `*.test.helpers.ts`로 부르는 이유: 헬퍼가 단언을 대신하는 경우(모든 시나리오에 `docFromNode` 통과 확인 등)가 있어, 이름이 `*.test.*` 밖이면 red 게이트 · 커밋 분리를 피해 테스트가 몰래 약해질 수 있다(#40 · #42 리뷰)
- 보안 · 데이터 테스트를 고쳐서 통과시키지 않는 이유: 초안 유출 · 잃어버린 수정(409) · XSS(URL 스킴) · AI 발행은 하나라도 제품을 끝낸다(plan 05 계약 층)

## 에러 처리

- API 응답 · 에러는 클라이언트 경계에서 정규화(`ConflictError` 등). UI는 성공 · 빈 · 로딩 · 에러만 렌더한다

## 스타일

- 토큰만: 사이트 `globals.css`의 값을 옮긴다(수동 복사, plan 09). 꾸미기 값은 스키마의 닫힌 집합(adr-008) — CSS가 아니라 데이터다

## 이 문서의 rot 방지

`scripts/check-docs.sh`(`pnpm verify`에 포함)가 여기 · CLAUDE.md · rules가 가리키는 경로와 명령이 존재하는지 검사한다. 깨지면 문서를 고치거나 지운다.
