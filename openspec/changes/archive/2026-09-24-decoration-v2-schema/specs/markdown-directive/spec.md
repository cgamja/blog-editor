## ADDED Requirements

### Requirement: `{align=…}`는 문단 · 제목 · 이미지의 정렬이다

지시어 키 `align`은 SHALL `left` · `center` · `right` 중 하나를 받는다. 문단 · 제목 · 이미지(앱 스크린샷 포함) 앞에서만 쓸 수 있다. 다른 블록 앞이나 정의 밖 값이면 지시어 값 오류로 거부한다.

#### Scenario: 정렬이 attrs가 된다

- **WHEN** `{align=center}` + 문단, `{frame=app align=right}` + 이미지를 변환한다
- **THEN** 문단 `attrs.align === "center"`, appScreenshot `attrs.align === "right"`

#### Scenario: 자리 밖 · 정의 밖 정렬은 거부한다

- **WHEN** `{align=center}` + `- 목록`, `{align=justify}` + 문단을 각각 변환한다
- **THEN** 둘 다 실패한다
