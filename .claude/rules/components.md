---
paths: ["apps/editor/editor-react/**/*.tsx", "apps/editor/web/**/*.tsx"]
---

# 컴포넌트 (editor-react · web)

- 파일명 = 컴포넌트명(PascalCase). 훅 `use*`, 핸들러 `handle*`, props `on*` **[사람 — 리뷰 2축]**
- 만들기 전에 grep: editor-react의 NodeView · 툴바 · 꾸미기 패널, web의 공용 UI. 재사용한 걸 PR에 적는다 **[사람 — 리뷰 2축]**
- 빈 · 로딩 · 에러 상태는 spec에 없어도 기본 포함(글 0편 · 저장 중 · 409 충돌 · 401) **[사람 — 리뷰 2축]**
- `role`/`aria-*` 수동 추가 전에 네이티브 요소로. 대체 텍스트 없는 이미지 · 클릭만 있는 div · 라벨 없는 input 금지 **[a11y.lint]**
- 디자인 캔버스가 정한 접근성(아이콘 버튼 `aria-label` · nav/aside 라벨 · 44px 컨트롤 · `:focus-visible` 윤곽 · reduced-motion)을 구현이 깎지 않는다. 대비 · 이름 없는 버튼 · 헤딩 순서는 axe 층이 생기기 전까지 사람이 본다 **[없음 — a11y.runtime 미선언, cgamja a11y-frontend §2 표를 PR에]**
- 꾸미기 값은 스키마의 닫힌 집합(adr-008)이지 CSS가 아니다 — 컴포넌트가 임의 스타일을 받지 않는다 **[tests.layers.unit]**
- 스타일 값은 토큰만 — 원천은 `packages/design-tokens/src/tokens.css`(adr-023). 척도에 없는 값은 같은 줄 · 윗줄에 `/* token-lint-ignore: <이유> */` **[`pnpm lint:css`(verify, adr-025) — 색 · 간격 · 선 두께 · 글자 크기 · 범위 변수. 반경 · 크기는 사람 · 리뷰 2축]**
- 200줄 또는 책임 2개면 분리. props 7개 넘으면 객체로 **[없음]**
- 정본 예시: [정본 없음 — 첫 공용 컴포넌트가 생기면 여기] **[없음]**
