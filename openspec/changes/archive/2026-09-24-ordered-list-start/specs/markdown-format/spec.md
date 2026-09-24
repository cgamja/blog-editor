## REMOVED Requirements

### Requirement: 같은 doc가 되는 변형은 받고, 정보를 잃는 변형은 거부한다

**Reason**: 번호 목록 시작 번호가 문서에 자리를 얻어(ordered-list-start) 더는 정보를 잃는 변형이 아니다. MODIFIED로는 옛 시나리오("순서 목록은 1부터만 받는다")를 뺄 수 없어 이름을 바꿔 다시 넣는다.

**Migration**: 아래 "같은 doc가 되는 변형과 시작 번호는 받고, 정보를 잃는 변형은 거부한다"가 대신한다.

## ADDED Requirements

### Requirement: 같은 doc가 되는 변형과 시작 번호는 받고, 정보를 잃는 변형은 거부한다

변환은 SHALL 결과 doc가 같아지는 표기 변형을 받는다 — `*`/`+` 글머리 · `1)` 구분자 · `_기울임_`/`__굵게__` · `~~~` 펜스 · 들여쓰기 코드 · autolink `<https://…>` · soft break(줄바꿈은 공백 하나). 번호 목록의 시작 번호는 `start`로 받는다(ordered-list-start). 스키마에 자리가 없어 정보를 잃는 것은 거부한다 — hard break(끝 공백 둘 · `\`) · 0으로 시작하는 번호 목록 · 글자와 섞인 인라인 이미지 · 링크/이미지 title.

#### Scenario: 줄바꿈은 soft break만 받는다

- **WHEN** 문단 안 줄바꿈 하나(`첫 줄\n둘째 줄`)와 hard break(`첫 줄  \n둘째 줄`)를 각각 변환한다
- **THEN** 앞은 `"첫 줄 둘째 줄"` 텍스트 하나가 되고, 뒤는 거부된다

#### Scenario: 순서 목록은 시작 번호를 start로 받는다

- **WHEN** `1. 가` · `2. 나`와 `3. 가` · `4. 나`를 각각 변환한다
- **THEN** 앞은 start 없는 `orderedList`, 뒤는 start 3 `orderedList`가 된다
