## MODIFIED Requirements

### Requirement: 꾸미기 어휘마다 규칙이 있다

CSS는 SHALL 스키마 enum의 모든 값에 규칙을 둔다 — `[data-font="pretendard"|"jua"|"gaegu"]`는 각각 `--font-sans` · `--font-display` · `--font-hand`, `[data-tone="note"|"tip"|"warning"]`는 각각 `--surface-2` · `--accent-soft` · `--brand-soft` 바탕, `[data-motion=…]` 5종은 각각 keyframes. `.post-block`은 `width: calc(var(--w, 100) * 1%)`로 폭을 받고 가운데 정렬, `position: relative`로 스티커의 기준이 된다. `.post-sticker`는 `top: calc(var(--y) * 1%)` · `width: calc(var(--s) * 1%)` · `height: auto` · `transform: translate(-50%, -50%) rotate(calc(var(--r) * 1deg))` · `pointer-events: none`이다. `left`는 모든 폭에서 `clamp(calc(var(--s) * 1%), calc(var(--x) * 1%), calc(100% - var(--s) * 1%))` — 중심을 가장자리에서 스티커 폭만큼 안으로 당겨, 90° 돌린 세로 긴 스티커(가로세로 비 2 이하)까지 블록 가로 안에 들어온다. 그래서 어느 폭에서도 스티커가 화면 가장자리에서 잘리지 않고, 본문 바깥 여백으로 튀어나오는 배치는 없다. 좁은 화면(`max-width: 48rem`)에서는 `top`도 `clamp(0%, …, 100%)`로 당긴다.

#### Scenario: 스키마 enum 값마다 선택자가 있다

- **WHEN** `FONTS` · `MOTIONS` · `CALLOUT_TONES`(`@blog-editor/content-schema`)의 각 값으로 `[data-font="…"]` · `[data-motion="…"]` · `[data-tone="…"]` 문자열을 만든다
- **THEN** 열한 문자열 전부 `post.css`에 들어 있다

#### Scenario: 스티커가 화면 가장자리에서 잘리지 않는다 (수동)

- **WHEN** `decorationMax`(스티커 `x` −25 · 125, `size` 25 포함)를 사이트에서 1280 · 375 폭으로 연다
- **THEN** 어느 스티커도 화면 가장자리에서 잘리지 않고 가로 스크롤이 없다 — 스크린샷 경로를 PR "확인 방법"에 적는다
