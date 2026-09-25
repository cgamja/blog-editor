## ADDED Requirements

### Requirement: 표는 선과 머리 행 바탕으로 그리고 좁으면 가로로 스크롤한다

CSS는 SHALL `.post-table-scroll`에 `overflow-x: auto`를 두어 본문보다 넓은 표가 페이지를 넓히지 않고 틀 안에서 스크롤하게 한다. 표는 칸 사이 선(`--line`)을 합쳐 그리고(`border-collapse: collapse`), 머리 칸은 `--surface-2` 바탕과 굵은 글자다. `[data-align="center"|"right"]`는 각각 `text-align: center|right`다. 값은 토큰만 쓴다.

#### Scenario: 표 어휘마다 규칙이 있다

- **WHEN** `post.css`를 읽는다
- **THEN** `.post-table-scroll` 규칙에 `overflow-x: auto`가, 칸 정렬 규칙에 `[data-align="center"]` · `[data-align="right"]`가 있다

#### Scenario: 좁은 화면에서 페이지가 가로로 넓어지지 않는다

- **WHEN** 실브라우저 375px 폭에서 열이 많은 표가 든 글의 편집 화면을 연다(편집 본문도 `post-body`라 같은 CSS를 쓴다)
- **THEN** 문서의 가로 스크롤 폭이 화면 폭을 넘지 않고, 표 틀의 스크롤 폭은 틀 폭보다 크다
