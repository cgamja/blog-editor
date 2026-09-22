# blog-editor

심심이스튜디오 블로그(simsimeestudio.com/blog)용 백오피스 에디터. 별도 서비스(`editor.simsimeestudio.com`)이고, 사이트 레포(`~/simsimeestudio-intro`)는 빌드할 때 이 서비스의 공개 API에서 **메타 + 렌더된 HTML**을 받는다. 두 레포 사이에 코드 의존은 없다.

## 읽는 순서

1. `adr/` — 왜 이렇게 만들었나 (D1~D14 결정 기록이 원천)
2. `~/2026-09-20 blog-plan.md` — 설계 문서(어떻게 만드는가). 3-3 구조 · 3-4 저장 형식 · 05 테스트 층 · 11 M0 스파이크
3. PRD https://claude.ai/artifact/Rm3nPgTioyyenou6MTjoNW (PRD · 디자인 · 아키텍처 상세 탭) · 화면 디자인 https://claude.ai/artifact/UkuCE9TwgtodyfShVeybSB
4. GitHub 이슈 — 마일스톤 M0~M6. 이슈 하나 = PR 하나.

## 구조 (plan 3-3)

```
packages/content-schema   zod 스키마 · schemaVersion · 마이그레이션 · 정규화 · 픽스처 — ProseMirror를 모른다
packages/content-convert  md → doc 변환 코어 (가져오기 · MCP 도구가 공유)
packages/content-render   doc → HTML 순수 렌더러 + 본문용 CSS (미리보기와 공개 API가 같은 것을 쓴다)
apps/editor/editor-core   TipTap 확장 + ProseMirror 순수 함수 커맨드·플러그인 — React 없음
apps/editor/editor-react  useEditor 마운트 · NodeView · 툴바 · 꾸미기 패널
apps/editor/web           화면 (React + Vite SPA + React Router + TanStack Query)
apps/editor/api           Hono (REST + /mcp) + PostStore(Memory · File · S3). 진입점: 로컬 Node · Lambda
apps/editor/infra         IaC
```

의존 방향과 라이브러리 경계는 `eslint.config.mjs`가 강제한다. 린트가 막으면 구조를 바꾸지 말고 이유를 묻는다.

## 규칙

- **테스트가 곧 명세다.** 순수 함수(스키마 · 변환 · 렌더 · 커맨드 · API 핸들러)는 Vitest node 환경에서 DOM 없이 테스트한다. 보안·데이터 테스트(공개 API에 초안 없음 · 409 · URL 스킴 허용 목록 · MCP 토큰으로 발행 불가)는 고쳐서 통과시키지 않는다.
- **닫힌 집합.** 문서에 들어갈 수 있는 것은 zod가 정의한다. 임의 CSS · 클래스 · 페이지 좌표 · 절대 URL 이미지는 자리가 없다.
- **문서 JSON이 원본**, markdown은 입력 전용. 정규형 하나(마크 순서 · 인접 텍스트 병합 · 키 순서).
- **ProseMirror/TipTap API는 기억으로 쓰지 않는다.** 공식 문서를 근거로 달고, 선택 영역 · 조합(IME) · NodeView 생명주기 변경은 실브라우저에서 확인한다. `view.composing` 중에는 문서를 바꾸는 부수 효과를 미룬다.
- **새 라이브러리는 LIBRARY 게이트(`~/cgamja-philosophy/docs/LIBRARY.md`) + ADR.** TipTap · Hono · prosemirror-markdown · React Router · MCP SDK 도 예외 없음.
- 1단계는 본인용(계정 1개 시드)이지만 저장 경로 `workspaces/<id>/posts/<slug>.json`과 계정 테이블 구조는 처음부터 잡는다(adr-007). 그 외 2단계 기능(가입 · 워크스페이스 UI · AI 이미지)은 구조로 막지 않되 만들지 않는다.
- 발행 도구는 MCP에 없다. AI는 초안만 쓴다. 발행은 사람이 에디터에서.

## 명령

```bash
pnpm install
pnpm verify   # typecheck · lint · format:check · test — 완료의 정의는 이 한 줄
pnpm test:watch
```

## 협업 규약

- 커밋: Conventional Commits, 한국어 제목 50자 이내, 테스트는 `test:`로 분리 (`~/cgamja-philosophy/docs/COMMIT.md`)
- 이슈 → 브랜치(`feat/…` `fix/…` `chore/…`) → PR. 템플릿은 `.github/`. PR 하나 = 목적 하나, 본문에는 "왜"와 "하지 않은 것".
- ADR은 `.github/ADR-TEMPLATE.md`를 복사해 `adr/YYYY-MM-DD-adr-NNN-<제목>.md`. append-only — 뒤집으면 새 ADR.
- 스파이크 코드는 버린다. 남기는 것은 결과(통과/실패 · 고른 대안)뿐이고 이슈와 plan 09에 적는다.
