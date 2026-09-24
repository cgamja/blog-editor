# spacing-tokens — 설계

## 1. 원천과 추출

Figma `cEy6fybMcrnEfokCc8XVQB` 페이지 65:3088에는 Variables가 없다(`get_variable_defs` 빈 결과). 아트보드는 캔버스 HTML 캡처라 CSS의 gap · padding이 auto-layout 값으로 남아 있다. 읽기 전용 스크립트로 여섯 아트보드의 auto-layout 276개에서 `itemSpacing`(SPACE_BETWEEN 제외) · padding 네 방향을 모았다.

## 2. 척도 고르기

- 두 아트보드 이상에 나오는 값만 척도로 둔다(한 곳에만 나오는 값은 그 화면의 사정이다): 64px(68:2 종이 위 한 곳)는 뺐다
- 1px padding(버튼 34곳)은 테두리 보정이라 간격이 아니다 — 뺐다
- 80px은 이미 `size.article-padding-x`다
- 디자인이 2px 단위로 쓴다(6 · 10 · 14 · 18 · 22 포함). 4px 격자로 반올림하지 않는다 — 없는 값을 만들지 않는다

## 3. 이름

`space.<px>` → `--space-<px>`(값은 rem). 이름이 px 값이라 척도 단계 번호와 헷갈리지 않는다. 기존 `--app-space-2/3/4/6/10`(8 · 12 · 16 · 24 · 40px)은 `app.css`에서 `var(--space-8)` 등의 별칭으로 남긴다 — 병렬 브랜치가 쓰는 이름을 깨지 않는다. 새 코드는 `--space-*`를 쓴다.
