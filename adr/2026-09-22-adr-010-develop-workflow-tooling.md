# ADR-010. 개발 흐름의 강제 수단 — lefthook · commitlint · OpenSpec · Claude Code 훅을 붙인다

- 날짜: 2026-09-22
- 상태: 승인됨
- 원천: cgamja develop-setup 대조표(2026-09-22) · `~/cgamja-philosophy/docs/{COMMIT,LIBRARY}.md`

## 문제 (맥락)

CLAUDE.md의 규칙(커밋 규약 · 테스트/구현 커밋 분리 · 보호 파일 · 테스트 변조 금지 · 완료 = `pnpm verify`)에 강제 수단이 없었다. 대조표 ✗ 14개 중 코드로 답이 나오는 것은 붙이고, 아직 대상 코드가 없는 것(a11y · 계약 · 경계 mock · 디자인 토큰)은 `null`로 선언해 다음 세팅에 보이게 한다.

## 결정

- **선언 한 곳**: `.claude/cgamja.json`이 강제 수단의 원천. 훅 · 스모크 · 리뷰어가 이것만 읽는다. 훅(`.claude/hooks/*.sh`)은 플러그인 템플릿을 그대로 복사하고 수정하지 않는다.
- **lefthook**(git 훅 매니저): `commit-msg`에 commitlint + "feat/fix/refactor 커밋에 테스트 파일 금지", `pre-commit`에 스테이지 파일 eslint/prettier, `pre-push`에 `pnpm verify`. 대화형 프롬프트 없음. postinstall 대신 `prepare`가 `lefthook install`을 돈다(pnpm 11 `allowBuilds` 승인 없이).
- **commitlint**(`config-conventional` + COMMIT.md): type 8개 · 제목 50자 · `subject-case` 해제(한국어 + 영어 고유명사 혼용 오탐).
- **OpenSpec**(`@fission-ai/openspec` devDependency 고정): Tier-2 작업은 `feature` 스키마(delta spec + tasks만). `config.yaml`의 `context`는 `scripts/openspec-context.sh`가 선언에서 생성한다 — 같은 사실을 손으로 두 번 쓰지 않는다. CI `openspec validate --archived --strict`. 한국어 Requirement 첫 문장에 `SHALL`을 병기한다.
- **Claude Code 훅**(`.claude/settings.json`): 보호 파일 Edit → ask, 테스트 파일 첫 Edit → ask(red 게이트), 쉘로 보호 경로 쓰기 · 검증 우회 플래그 · 패키지 추가 → deny, Stop → `pnpm verify`.
- `docs/adr` → `adr/` 심볼릭 링크, `adr/0001-domain-structure.md` → adr-009. 레포의 ADR 규약(`YYYY-MM-DD-adr-NNN`)은 그대로 두고 플러그인이 읽는 경로만 별칭으로 맞춘다.
- `verify`에 `docs:check`(`scripts/check-docs.sh`)를 더한다 — CLAUDE.md · rules · conventions가 가리키는 경로 · 명령의 존재 검사.

## LIBRARY 게이트 (devDependency 4개, 전부 MIT · 타입 내장 또는 불필요)

| 패키지                                     | 최근 릴리스 | 역할 겹침               | 대안                                           |
| ------------------------------------------ | ----------- | ----------------------- | ---------------------------------------------- |
| lefthook 2.1                               | 2026-09     | 없음(git 훅 매니저 0개) | husky — 훅마다 쉘 파일 · parallel 없음         |
| @commitlint/cli · config-conventional 21.2 | 2026-09     | 없음                    | commitizen — 대화형(에이전트 · non-TTY에서 행) |
| @fission-ai/openspec 1.13                  | 2026-09     | 없음                    | 전역 설치 — 버전 표류, CI 재현 불가            |

## 버린 대안

- **jsx-a11y를 지금 설치**: 마지막 릴리스 2024-10(23개월), peer가 ESLint 9까지 — 게이트 탈락. tsx가 0개라 web 패키지 생성 시 ESLint 10 호환 대안과 함께 다시 본다.
- **훅을 프로젝트에 맞게 수정**: 훅은 선언을 읽으므로 수정할 이유가 없고, 수정하면 플러그인 갱신을 못 받는다.
- **`docs/adr/`로 ADR 이동**: 레포 규약과 8건의 기존 링크를 깬다. 별칭이 싸다.

## 감수한 트레이드오프

- devDependency +131 패키지(대부분 commitlint 전이 의존성). 앱 번들과 무관.
- `pre-push`의 verify가 push마다 수 초. Stop 훅과 이중이지만 push는 사람이 하는 마지막 관문이라 남긴다.
- 제목 50자 제한이 기존 커밋 몇 건보다 엄격하다 — COMMIT.md가 정한 값이다.
- 훅이 너무 자주 막으면 우회 습관이 더 위험하다 — `retro-fe`로 마찰을 재고 범위를 줄인다.

## 재검토 조건

- web/api 패키지가 생길 때: `a11y.lint` · `mock.boundary`(msw) · `contract`(openapi) · `design.tokens` · `commands.dev` 선언(`.claude/cgamja.json`의 `null`이 목록이다).
- 훅 deny/ask가 세션당 5회를 넘으면 범위 재조정.
