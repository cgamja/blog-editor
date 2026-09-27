## ADDED Requirements

### Requirement: 글자만 바꾸는 부분 고치기는 블록 간격을 지킨다

`editDocRange`는 SHALL 한 글자 블록 안 글자만 바꿀 때 그 블록의 `space`를 그대로 둔다(블록 꾸밈과 같다).

#### Scenario: 간격 lg 문단 안 글자

- **WHEN** `space: lg` 문단 `둘째 문단이다`에서 `둘째`를 `셋째`로 바꾼다
- **THEN** 결과 문단은 `space: lg`이고 글자는 `셋째 문단이다`다
