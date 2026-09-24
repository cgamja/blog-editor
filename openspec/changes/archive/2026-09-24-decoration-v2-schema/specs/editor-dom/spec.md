## ADDED Requirements

### Requirement: 새 마크와 정렬도 공개 HTML과 같은 어휘로 나가고 다시 읽힌다

에디터 스키마는 SHALL 마크 `textStyle` · `strike` · `underline`과 블록 `align`을 content-render와 같은 태그 · 클래스 · data 속성으로 낸다(render-decoration). 같은 모양의 HTML을 다시 읽으면 같은 attrs가 된다.

- 읽을 때 값은 content-schema 집합으로 검증한다. 모르는 값 · 글꼴에 없는 두께는 없는 것으로 본다
- 남의 사이트 HTML의 `style="color:…"` · `<font>`는 읽지 않는다
- `<s>` · `<del>` · `<strike>`는 `strike`, `<u>`는 `underline`으로 읽는다

#### Scenario: 새 마크와 정렬이 DOM을 거쳐도 같다

- **WHEN** 두 블록을 DOM 스펙으로 낸 뒤 파싱 규칙으로 다시 읽는다
  - textStyle `{ color: "#12abef", size: "xl" }` + `strike` + `underline` 텍스트가 있는 `align: "center"` 문단
  - `align: "left"` 이미지
- **THEN** attrs와 마크가 원래와 같다

#### Scenario: 남의 인라인 스타일은 마크가 되지 않는다

- **WHEN** `<p><span style="color:red">가</span><span class="post-ts" data-color="pink">나</span></p>`를 파싱한다
- **THEN** 두 글자 모두 textStyle 마크가 없다
