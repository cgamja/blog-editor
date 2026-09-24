## ADDED Requirements

### Requirement: 두께를 지정한 글자는 가짜 굵기로 그리지 않는다

`post.css`는 SHALL `.post-ts[data-weight]`에 `font-synthesis-weight: none`을 둔다. 글자 글꼴이 없으면 블록 글꼴(Jua 문단 · 기본 Jua 제목 등)을 물려받아, 그 글꼴에 없는 두께가 될 수 있기 때문이다(ADR-020).

#### Scenario: 두께 규칙에 합성 굵기 끄기가 있다

- **WHEN** `post.css`에서 `.post-ts[data-weight]` 규칙을 찾는다
- **THEN** 그 규칙에 `font-synthesis-weight: none`이 있다
