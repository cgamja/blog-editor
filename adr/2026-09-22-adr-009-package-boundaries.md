# ADR-009. 패키지 경계 — 의존 방향 표를 정본으로, 상대경로로 경계를 넘는 import도 막는다

- 날짜: 2026-09-22
- 상태: 승인됨 · 일부 대체 → adr-015(테스트 전용 `./testing` 진입점)
- 원천: plan 3-3 · CLAUDE.md 구조 · develop-setup 프로브(2026-09-22)
- 별칭: `adr/0001-domain-structure.md` → 이 파일 (cgamja 플러그인이 `docs/adr/0001-domain-structure.md`를 읽는다)

## 문제 (맥락)

의존 방향은 CLAUDE.md와 `eslint.config.mjs`에 있었지만, 린트는 `@blog-editor/<name>` 이름만 막았다. 세팅 프로브에서 `../../content-render/src/index`(content-schema에서) · `../../../../packages/content-schema/src/index`(api에서) · 루트에서 `./packages/content-schema`가 전부 **통과**했다. 문서에만 있는 경계는 AI가 편한 길로 넘는다(plan 10장).

## 결정

- 구조의 단위는 워크스페이스 패키지(`packages/*` · `apps/editor/*`)다. 패키지 사이는 **`@blog-editor/<name>`으로만** import하고, 공개 진입점은 각 패키지의 `index.ts` 하나(named export만).
- 허용 엣지(린트 · `eslint.boundaries.test.ts`와 1:1 — 셋을 함께 고친다):

| from            | to                                                | 이유                                   |
| --------------- | ------------------------------------------------- | -------------------------------------- |
| content-render  | content-schema                                    | 검증된 doc만 렌더한다                  |
| content-convert | content-schema                                    | md → doc 결과가 스키마를 통과해야      |
| editor-core     | content-schema · content-convert                  | 붙여넣기 · 가져오기가 변환 코어를 쓴다 |
| editor-react    | editor-core · content-render · content-schema     | 미리보기가 렌더러를 쓴다               |
| api             | content-schema · content-convert · content-render | 서버가 에디터 없이 변환 · 렌더         |
| web             | editor-react · content-schema                     | 화면은 에디터 React 층만 안다          |

- 라이브러리 경계: content-schema는 ProseMirror를 모른다 · TipTap은 editor-core/editor-react 밖으로 안 나간다 · React는 editor-react/web에만.
- **상대경로로 다른 패키지에 들어가는 import를 막는다.** `no-restricted-imports` 패턴을 `../` `./`로 앵커해(`../**/content-render/**`, `./**/packages/**` 등) 패키지 이름 import는 건드리지 않는다. `api` · `web`은 흔한 디렉터리 이름이라(`../api/client`는 정상) `<name>/src` 모양만 막는다.
- 막는 모양과 통과해야 하는 모양은 `eslint.boundaries.test.ts`가 열거한다 — 설정이 회귀하면 verify가 빨강이다.

## 버린 대안

- **eslint-plugin-boundaries / import-x `no-relative-packages`**: 경로를 해석해 정확히 막는다. 그러나 새 의존성 둘 + resolver 설정(플러그인 실측: resolver 키가 빠지면 조용히 통과)이 든다. 지금 패키지 7개 · 이름이 고정이라 기존 규칙의 패턴 열거로 충분하고, 테스트가 회귀를 잡는다.
- **TypeScript `rootDir`**: symlink된 워크스페이스 패키지에서 TS6059가 나는지 미검증. 린트 한 곳이 낫다.
- **문서로만 두기**: 프로브가 통과하는 것을 봤다.

## 감수한 트레이드오프

- 글롭 근사: 패키지 안에 다른 패키지와 같은 이름의 디렉터리(`content-schema/`)를 두면 오탐. 이름이 `content-*` · `editor-*`라 실제로는 없다. `api`/`web`은 `<name>/src` 모양 밖의 우회(`../../api/handlers`가 진짜 apps/editor/api를 가리키는 경우)를 못 잡는다 — api · web은 누구도 의존하지 않는 잎이라 실익이 없는 우회다.
- 엣지 하나 추가에 파일 셋(ADR 표 · 린트 · 테스트)을 고친다. 그게 의도다.

## 재검토 조건

- 패키지가 7개를 넘거나 이름이 흔한 단어로 늘어날 때 → eslint-plugin-boundaries를 LIBRARY 게이트로 검토.
- 상대경로 우회가 실제로 머지된 것이 발견될 때.
