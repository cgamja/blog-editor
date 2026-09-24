# shared-design-tokens (이슈 #103)

## Why

#101(PR #102)에서 생긴 간격 · 선 두께 · 포커스 고리 토큰은 web 안의 `tokens.css`에만 있었다. editor-react는 web을 import할 수 없어(adr-009) 그 파일을 못 불러오고, 에디터 CSS는 px/rem 값을 직접 적고 플레이그라운드는 색 토큰을 손으로 한 벌 더 가졌다. 토큰 원천이 바뀌면 에디터 쪽이 조용히 어긋난다.

## What Changes

- 새 잎 패키지 `packages/design-tokens`(adr-023): `tokensToCss` 생성기 · 동기화 테스트 · `tokens.css` · 생성 스크립트를 web에서 옮긴다. 공개 진입점은 `./tokens.css` 하나
- 허용 엣지 `web → design-tokens` · `editor-react → design-tokens`(adr-009 표 · 린트 · 경계 테스트)
- web 진입점 · 가져오기 미리보기 iframe · editor-react 플레이그라운드가 같은 `tokens.css`를 불러온다. 플레이그라운드의 손으로 쓴 `:root` 블록을 지운다
- editor-react CSS(`editor.css` · `editor-screen.css` · `text-toolbar.css`)와 플레이그라운드 CSS의 간격 · 선 두께 · 포커스 고리 값 중 척도에 맞는 것을 `--space-*` · `--border-width` · `--focus-ring-*`로 바꾼다. 같은 값의 크기 · 글자 크기 · 그림자 토큰(`--control-height` · `--font-size-ui` · `--font-size-caption` · `--shadow-paper*` · `--radius-pill`)이 이미 있으면 그것을 참조하고 범위 변수 사본을 지운다

## Impact

- 화면 모양은 그대로다(값이 같다) — 전후 스크린샷으로 확인
- 하지 않는 것: content-render `post.css`(공개 출력 — 사이트 토큰과의 관계는 따로), 척도에 없는 값을 토큰으로 새로 만들기(목록으로 남긴다), 반지름 · 팝오버 그림자 토큰화
