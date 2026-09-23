## ADDED Requirements

### Requirement: 이미지 원본 크기는 size 지시어로 나른다

`serializeMarkdown`은 SHALL `naturalWidth` · `naturalHeight`가 있는 이미지 · 앱 스크린샷의 지시어 줄 끝에 `size=<가로>x<세로>`를 쓴다(키 순서 `frame` · `font` · `motion` · `width` · `size`). 원본 크기는 losses가 아니다 — 다시 변환하면 같은 값이 된다.

#### Scenario: 크기가 지시어로 나가고 다시 돌아온다

- **WHEN** `src: "/images/a.webp"` · `alt: "그림"` · `width: 60` · `naturalWidth: 1200` · `naturalHeight: 800`인 이미지 하나를 직렬화하고 그 결과를 다시 변환한다
- **THEN** markdown은 `{width=60 size=1200x800}`+`![그림](/images/a.webp)`이고 `losses`는 `[]`이며, 다시 변환한 doc는 원래 doc와 같다
