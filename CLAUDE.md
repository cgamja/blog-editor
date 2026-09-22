# blog-editor

심심이스튜디오 블로그(simsimeestudio.com/blog)용 백오피스 에디터. 별도 서비스(`editor.simsimeestudio.com`)이고, 사이트 레포(`~/simsimeestudio-intro`)는 빌드할 때 이 서비스의 공개 API에서 **메타 + 렌더된 HTML**을 받는다. 두 레포 사이에 코드 의존은 없다.

## 하지 않는 것 (훅 · 린트가 막는다 — 이유를 알고 우회하지 않는다)

- 새 의존성 · 보호 파일(매니페스트 · lockfile · 린트/훅 설정 · `.claude/cgamja.json`) 변경을 쉘로 — Edit로 제안하면 **사람이 diff를 보고 승인**한다. `pnpm add`류는 거부된다. 새 라이브러리는 LIBRARY 게이트(`~/cgamja-philosophy/docs/LIBRARY.md`) + ADR 먼저. TipTap · Hono · prosemirror-markdown · React Router · MCP SDK도 예외 없음
- 테스트를 초록으로 만들기 위한 테스트 수정 — 첫 테스트 편집은 세션당 1회 사람 승인(red 게이트). 각 red의 실패 출력 원문을 보고하고 `test:` 커밋으로 분리. **보안 · 데이터 테스트(공개 API에 초안 없음 · 409 · URL 스킴 허용 목록 · MCP 토큰으로 발행 불가)는 고쳐서 통과시키지 않는다**
- 패키지 경계 넘기 — 의존 방향 역행, TipTap/React/ProseMirror를 허용 패키지 밖에서, 상대경로로 다른 패키지에 들어가기. ESLint가 막는다. 막히면 구조를 바꾸지 말고 이유를 묻는다
- `--no-verify`, `git push --force`, 훅 우회 환경변수 (거부됨)
- ProseMirror/TipTap API를 기억으로 쓰기 — 공식 문서를 근거로 달고, 선택 영역 · 조합(IME) · NodeView 생명주기 변경은 실브라우저에서 확인한다. `view.composing` 중에는 문서를 바꾸는 부수 효과를 미룬다
- 발행 도구를 MCP에 넣기 — AI는 초안만 쓴다. 발행은 사람이 에디터에서

## 읽는 순서

1. `adr/` — 왜 이렇게 만들었나 (D1~D14 결정 기록이 원천)
2. `~/2026-09-20 blog-plan.md` — 설계 문서(어떻게 만드는가). 3-3 구조 · 3-4 저장 형식 · 05 테스트 층 · 11 M0 스파이크
3. PRD https://claude.ai/artifact/Rm3nPgTioyyenou6MTjoNW (PRD · 디자인 · 아키텍처 상세 탭) · 화면 디자인 Figma https://www.figma.com/design/cEy6fybMcrnEfokCc8XVQB 페이지 "Editor design" (노드 인덱스 `design/map.md` · 뽑은 값 `design/tokens.json`)
4. GitHub 이슈 — 마일스톤 M0~M6. 이슈 하나 = PR 하나. Tier-2 작업은 OpenSpec change로(`openspec list`가 열린 change)
5. 필요할 때(`@`로 불러오지 않는다): `.claude/cgamja.json`(선언 — 강제 수단의 원천) · `.claude/rules/`(파일별 규칙과 각 규칙의 강제 수단) · `docs/conventions.md`(이유) · `openspec/specs/`(행동 스펙) · 작업 절차는 develop-fe 스킬

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

의존 방향과 라이브러리 경계는 `eslint.config.mjs`가 강제하고, 허용 엣지 표는 adr-009(`docs/adr/0001-domain-structure.md`)에 있다. 패키지 사이는 `@blog-editor/<name>`으로만 import한다.

- **테스트가 곧 명세다.** 순수 함수(스키마 · 변환 · 렌더 · 커맨드 · API 핸들러)는 Vitest node 환경에서 DOM 없이 테스트한다.
- **닫힌 집합.** 문서에 들어갈 수 있는 것은 zod가 정의한다. 임의 CSS · 클래스 · 페이지 좌표 · 절대 URL 이미지는 자리가 없다.
- **문서 JSON이 원본**, markdown은 입력 전용. 정규형 하나(마크 순서 · 인접 텍스트 병합 · 키 순서).
- 1단계는 본인용(계정 1개 시드)이지만 저장 경로 `workspaces/<id>/posts/<slug>.json`과 계정 테이블 구조는 처음부터 잡는다(adr-007). 그 외 2단계 기능(가입 · 워크스페이스 UI · AI 이미지)은 구조로 막지 않되 만들지 않는다.

## 명령

```bash
pnpm install   # prepare가 lefthook 훅(commit-msg · pre-commit · pre-push)을 건다
pnpm verify    # typecheck · lint · format:check · test · docs:check — 완료의 정의는 이 한 줄. 끝났다고 말하기 전에 이 출력을 보여라
```

## 협업 규약

- 커밋: Conventional Commits, 한국어 제목 50자 이내, 테스트는 `test:`로 분리 — commitlint + lefthook이 검사한다(`~/cgamja-philosophy/docs/COMMIT.md`)
- 이슈 → 브랜치(`feat/…` `fix/…` `chore/…`) → PR. 템플릿은 `.github/`. PR 하나 = 목적 하나, 본문에는 "왜"와 "하지 않은 것".
- ADR은 `.github/ADR-TEMPLATE.md`를 복사해 `adr/YYYY-MM-DD-adr-NNN-<제목>.md`. append-only — 뒤집으면 새 ADR. `docs/adr`는 같은 폴더의 별칭(cgamja 도구가 그 경로를 읽는다).
- 스파이크 코드는 버린다. 남기는 것은 결과(통과/실패 · 고른 대안)뿐이고 이슈와 plan 09에 적는다.

## 가정 (세팅 때 묻지 않고 정한 것 — 틀리면 고쳐라)

플랫폼 web-desktop(디자인 1360×860 · 1280 기본, 768 · 375 확인) · 다크 없음(디자인이 라이트만, `evidence.dark: false`) · 경계 mock(msw) · 계약(openapi)은 web/api가 생길 때 · web의 Vite는 `PORT` env + `strictPort`(병렬 worktree 전제) · OpenSpec 한국어 Requirement 첫 문장에 `SHALL` 병기(`--strict`)
