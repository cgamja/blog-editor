## ADDED Requirements

### Requirement: 글자 스타일 · 취소선 · 밑줄 · 정렬도 잃지 않고 쓴다

`serializeMarkdown`은 SHALL 새 값을 다음 문법으로 쓰고, 이 값들은 `losses`에 들어가지 않는다(ADR-020).

- `strike` → `~~…~~`
- `textStyle` · `underline` → 괄호 span `[…]{…}`
  - 키 순서: `font` `weight` `size` `color` `highlight` `underline`
  - 같은 textStyle · underline 조합이 이어진 텍스트는 한 span으로 묶는다
- `align` → 블록 지시어의 `align=`

왕복 속성 테스트(losses가 없는 doc는 왕복해도 같다)의 생성기는 새 마크와 `align`을 포함한다.

#### Scenario: 새 마크와 정렬이 문법으로 나오고 되돌아온다

- **WHEN** 두 블록을 직렬화한 뒤 다시 변환한다
  - `align: "center"` 문단: "가"(textStyle `{ color: "brand" }` + `underline`) + "나"(`strike`)
- **THEN** `markdown`이 `{align=center}\n[가]{color=brand underline}~~나~~\n`이고 결과 doc가 같다
