## ADDED Requirements

### Requirement: 편집 화면 틀은 제목 · 알림 띠 자리와 바깥에서 고르는 탭을 받는다

`EditorScreen`은 SHALL 종이 위 본문 앞에 `title`을, 머리줄 아래에 `banner`를 그린다. `tab` · `onTabChange`를 받으면 옆 패널 탭을 바깥에서 고른다(「글 정보」의 「꾸미기 열기」). 받지 않으면 지금처럼 틀이 탭을 스스로 고른다.

#### Scenario: 꾸미기 열기 (실브라우저)

- **WHEN** 편집 화면 「글 정보」 탭에서 「꾸미기 열기」를 누른다
- **THEN** 「꾸미기」 탭이 선택되고 꾸미기 패널이 보인다
