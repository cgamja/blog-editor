## ADDED Requirements

### Requirement: `{space=…}`는 블록 위 간격이다

변환기는 SHALL 지시어 키 `space`를 사진 자리를 뺀 모든 최상위 블록에 받아 그 블록 attrs의 `space`로 둔다(adr-037). 값은 `sm` · `lg` · `xl`뿐이다. 그 밖의 값은 받은 값과 허용 값을 알려 주는 지시어 값 오류로 실패한다.

#### Scenario: 여러 블록의 간격

- **WHEN** 문단 · 제목 · 이미지 · 표 · 구분선 앞에 차례로 `{space=sm}` · `{font=jua space=lg}` · `{space=xl}` · `{space=lg}` · `{space=sm}`을 쓴다
- **THEN** 블록 attrs의 `space`가 차례로 `sm` · `lg` · `xl` · `lg` · `sm`이고, 제목에는 `font: jua`도 있다

#### Scenario: 단계 밖 값

- **WHEN** `{space=12px}` 뒤에 문단을 쓴다
- **THEN** 실패하고, 메시지에 받은 값 `12px`와 `sm · lg · xl`이 있다
