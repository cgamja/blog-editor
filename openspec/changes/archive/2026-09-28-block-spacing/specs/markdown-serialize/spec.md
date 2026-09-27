## ADDED Requirements

### Requirement: 간격은 지시어 끝에 나간다

직렬화는 SHALL 블록 attrs의 `space`를 지시어 줄의 기존 키(`frame` · `font` · `motion` · `align` · `width` · `size`) 뒤에 `space=<값>`으로 쓴다. 다시 읽으면 같은 문서다(무손실).

#### Scenario: 글꼴 · 정렬 · 간격 문단

- **WHEN** `font: gaegu` · `align: center` · `space: xl` 문단 `가`를 직렬화한다
- **THEN** `{font=gaegu align=center space=xl}` 다음 줄에 `가`가 나오고, 손실이 없고, 다시 읽으면 정규형이 같다
