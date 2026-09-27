## ADDED Requirements

### Requirement: 간격은 래퍼의 data-space로 나온다

렌더러는 SHALL `space`가 있는 최상위 블록을 꾸밈 래퍼 `div.post-block`으로 감싸고 `data-space="<값>"`을 낸다. 속성 순서는 class → data-font → data-motion → data-align → data-space → style이다.

#### Scenario: 문단 · 이미지 · 제목의 간격

- **WHEN** `space: lg` 문단, `width: 60` · `space: xl` 이미지, `font: jua` · `align: center` · `space: sm` 제목을 렌더한다
- **THEN** 차례로 `<div class="post-block" data-space="lg"><p>…`, `<div class="post-block" data-space="xl" style="--w:60"><figure …`, `<div class="post-block" data-font="jua" data-align="center" data-space="sm"><h2>…`가 나온다
