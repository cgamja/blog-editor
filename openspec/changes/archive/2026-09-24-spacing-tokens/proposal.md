# spacing-tokens (이슈 #101)

## Why

`design/tokens.json`에 간격 척도가 없어 web `app.css`가 `--app-space-*`를 손으로 정했다(#100 리뷰: 원천에 없는 값을 앱이 정했다). 사용자 결정(2026-09-24): 간격 값은 Figma에서 뽑는다. Figma 파일에는 Variables가 0개라, 아트보드 auto-layout의 gap · padding이 유일한 원천이다.

## What Changes

- `design/tokens.json`에 `space` 그룹: Figma 아트보드 여섯 장(66:2 · 67:2 · 68:2 · 69:2 · 70:2 · 71:2)에서 두 장 이상에 나오는 gap · padding 값만(2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 28 · 32 · 36 · 40 · 56px). 출처 표는 `design/map.md`
- `size`: `border-width` 1px(선 두께 72곳 중 55곳) · 포커스 고리를 설명 문자열 대신 `focus-ring-width` · `focus-ring-offset` 길이 토큰으로
- web 토큰 생성기가 `space.<n>`을 `--space-<n>`(rem)으로 내보낸다
- `app.css` 머리의 손으로 쓴 블록을 지우고 생성 토큰을 쓴다. 병렬 화면 작업(#96 #97 #98)이 쓰는 `--app-space-*` 이름은 생성 토큰의 별칭으로 남긴다(값 그대로 1:1)

## Impact

- 하지 않는 것: editor-react CSS(플레이그라운드는 web `tokens.css`를 불러오지 않아 `--space-*`가 정의되지 않는다 — 의존 방향상 editor-react가 web을 못 본다), content-render `post.css`(공개 출력), Figma에 Variables 만들기(쓰기 안 함)
