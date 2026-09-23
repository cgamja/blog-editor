# Spec Delta — render-safety

## Purpose

렌더 결과는 사이트가 그대로 꽂는 HTML이다. 스크립트가 실릴 길이 렌더러에 없다는 것을 회귀 테스트로 고정한다 — 사이트의 sanitize(#8)는 두 번째 방어선이지 첫 번째가 아니다(plan 05 계약 층).

## ADDED Requirements

### Requirement: 렌더 결과에 스크립트 · 이벤트 핸들러 · javascript: 스킴이 없다 (보호 대상 — 고쳐서 통과시키지 않는다)

`renderHtml`의 출력은 SHALL 어떤 입력에서도 `<script` · 공백 뒤 `on[a-z]+=` 형태의 속성 · `javascript:` 스킴을 담지 않는다. 문서 문자열은 전부 이스케이프되고, 속성은 렌더러가 닫힌 목록에서만 만든다(`class` · `data-font` · `data-motion` · `data-tone` · `data-language` · `style` · `href` · `src` · `alt` · `width` · `height` · `loading` · `decoding`). `href`는 스키마가 스킴을 이미 막지만 렌더러도 이스케이프해 속성 경계를 지킨다. 이 테스트를 통과시키기 위해 단언을 완화하지 않는다.

#### Scenario: 대표 픽스처와 적대적 문서 모두 금지 패턴이 없다

- **WHEN** `fixtures` 3개와, 텍스트 · `alt` · `caption` · `codeBlock` 본문에 `<script>alert(1)</script>` · `" onload="x` · `javascript:alert(1)`를 넣은 문서를 각각 렌더한다
- **THEN** 어느 출력에도 `/<script/i` · `/\son[a-z]+=/i` · `/javascript:/i`가 매치되지 않는다(적대적 문자열은 이스케이프된 글자로만 남는다)

#### Scenario: 속성은 닫힌 목록 밖으로 나가지 않는다

- **WHEN** `fixtures.decorationMax`를 렌더하고 출력의 모든 `속성명=` 꼴을 모은다
- **THEN** 집합이 위 목록의 부분집합이다

실패 의미론: 해당 없음 — 순수 함수.
