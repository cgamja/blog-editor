# ADR-023. 디자인 토큰 CSS는 잎 패키지 `design-tokens`가 갖고, web과 editor-react가 같은 파일을 불러온다

- 날짜: 2026-09-24
- 상태: 승인됨 (PR 머지 = 승인)
- 원천: 이슈 #103 · adr-009(패키지 경계) · adr-022(web은 토큰 CSS 변수 + 일반 CSS)

## 문제 (맥락)

#101(PR #102)에서 `design/tokens.json`에 간격 · 선 두께 · 포커스 고리 토큰이 생겼고, 생성기 `tokensToCss`와 결과 `tokens.css`는 web 안(`apps/editor/web/src/styles/`)에 있었다. editor-react는 web을 import할 수 없어(adr-009 의존 방향) 그 CSS를 못 불러온다. 그래서 editor-react CSS는 간격 · 선 두께 · 포커스 고리를 px로 직접 적고, 플레이그라운드는 색 토큰을 손으로 한 벌 더 정의했다(`playground.css`). 토큰 원천이 바뀌면 에디터 쪽이 조용히 어긋난다.

## 결정

- 새 워크스페이스 패키지 **`packages/design-tokens`**(`@blog-editor/design-tokens`)가 생성기 `tokensToCss` · 동기화 테스트 · 생성 결과 `tokens.css` · 생성 스크립트(`pnpm --filter @blog-editor/design-tokens tokens`)를 갖는다. 공개 진입점은 CSS 하나(`./tokens.css`)다.
- 이 패키지는 **잎**이다 — 어떤 워크스페이스 패키지도 import하지 않고, TipTap · ProseMirror · React도 쓰지 않는다.
- 허용 엣지 둘을 더한다(adr-009 표 · `eslint.config.mjs` · `eslint.boundaries.test.ts`를 함께 고친다):
  - `web → design-tokens` — 앱 진입점이 `tokens.css`를 한 번 불러온다
  - `editor-react → design-tokens` — 에디터 CSS가 같은 변수 이름(`--space-*` · `--border-width` · `--focus-ring-*`)을 쓰고, 플레이그라운드가 같은 파일을 불러온다(devDependency — content-render `post.css`와 같은 방식. 라이브러리 CSS는 변수를 쓰기만 하고 `:root` 값은 앱이 준다)
- content-render `post.css`(공개 출력)는 이 패키지를 쓰지 않는다 — 사이트 쪽 토큰과의 관계는 따로 정한다.

## 버린 대안

- **content-schema가 CSS 자산으로 내보내기**: web · editor-react 둘 다 이미 content-schema에 의존하므로 새 엣지가 없다. 그러나 content-schema는 "저장 형식의 주인"(zod · schemaVersion · 정규화)이고, 화면 토큰은 문서 형식이 아니다. 저장 형식 패키지에 화면 색이 들어가면 api · content-convert까지 화면 값을 끌고 다니고, 패키지 설명과 책임이 흐려진다.
- **content-render에 두기**: `post.css`와 같은 자리지만 공개 출력용 CSS와 백오피스 화면 토큰이 섞인다. web은 content-render에 의존하지 않아 새 엣지가 필요한 것도 같다.
- **editor-react가 갖고 web이 거기서 불러오기**: 엣지는 이미 있다(web → editor-react). 그러나 로그인 · 글 목록처럼 에디터와 무관한 화면의 토큰 원천이 에디터 React 층이 되고, 생성기(node 스크립트 · 순수 함수)가 React 패키지에 들어간다.
- **파일을 두 벌 두고 테스트로 동기화**: 원천이 둘이 되는 것을 테스트로 막는 셈 — 한 벌로 두면 테스트가 필요 없다.

## 감수한 트레이드오프

- 패키지가 7개에서 8개로 늘고, 엣지 둘 추가에 파일 셋(ADR 표 · 린트 · 테스트)을 고친다. adr-009 재검토 조건("7개를 넘을 때 eslint-plugin-boundaries 검토")에 닿는다 — 이름이 흔한 단어가 아니고 잎이라 우회 경로가 없으므로, 지금은 패턴 열거를 유지하고 다음 패키지 추가 때 다시 본다.
- editor-react 라이브러리 CSS는 `:root` 변수가 있어야 모양이 맞는다(색은 이미 그랬다). 불러오는 쪽이 `tokens.css`를 잊으면 간격(`--space-*`)이 0으로 붙고 fallback 없는 선 두께 · 포커스 고리가 사라진다. 기능에 닿는 값 — 누르는 칸 크기 `--control-height`, 알약 반경 `--radius-pill`, 색 fallback이 있는 선언의 선 두께 — 에만 fallback을 둬서 손잡이 · 메뉴 위치 · 선택 외곽선은 무너지지 않는다. 불러오는 곳이 web 진입점과 플레이그라운드 두 곳뿐이라 나머지는 받아들인다.
- 플레이그라운드의 글꼴 대체 스택이 web과 같아진다(`"Jua", sans-serif`). 전에는 `"Jua", "IBM Plex Sans KR", sans-serif`였다. Jua 한글 글리프 누락(#107)은 거기서 다룬다.

## 재검토 조건

- 사이트 레포와 토큰을 공유하게 되면(공개 CSS가 같은 변수를 쓰게 되면) — 이 패키지를 공개 API 자산으로 낼지 다시 본다.
- 토큰 소비자가 셋을 넘으면 → 진입점 CSS 분할(색 · 간격 등) 검토.
