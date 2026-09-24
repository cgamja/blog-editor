# decoration-v2-review (PR #77 리뷰 반영)

## Why

ADR-020에서 공개 HTML의 어휘가 늘었다. 새 data 속성 5개와 글자 스타일 CSS 변수 `--ts-color` · `--ts-highlight`다. 그런데 render-safety 스펙의 닫힌 속성 목록과 불변식이 이것을 반영하지 않았다.

리뷰에서 검사와 출력이 다른 글자를 보는 경우도 나왔다. 검증을 건너뛴 색 값이 `toString` 객체면 hex 검사는 통과하고, 출력할 때 CSS 선언이 이어 붙는다.

## What Changes

- render-safety
  - 닫힌 속성 목록에 `data-align` · `data-weight` · `data-size` · `data-color` · `data-highlight`를 더한다. 목록은 여전히 닫혀 있다
  - `style` 값 불변식을 둔다: 선언은 스티커 · 폭 정수 변수(`--x/y/s/r/w`)와 글자 스타일 hex 변수(`--ts-color` · `--ts-highlight`)만 허용한다
- markdown-format
  - 겹친 괄호 span을 거부한다
  - 이미지 대체 글자 안의 span 모양은 원문 그대로 둔다
- render-css: 두께 지정 글자에 `font-synthesis-weight: none`을 넣는다

## Impact

보안 테스트가 바뀐다. 허용 목록에 5개를 추가하고(닫힘 유지) 불변식 테스트를 추가한다. 기존 단언은 완화하지 않는다. **사람 승인이 필요하다.**
