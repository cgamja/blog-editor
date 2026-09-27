## ADDED Requirements

### Requirement: 할 일 항목은 읽기 전용 체크 칸으로 낸다

렌더러는 SHALL `checked`가 있는 목록 항목을 `<li class="post-task">`로 내고, 항목 문단 `<p>` 맨 앞에 `<input type="checkbox" disabled aria-label="완료">`를 둔다(`checked: true`면 `checked` 속성을 더한다, adr-036). 읽는 사람은 체크를 바꿀 수 없고(`disabled`), 스크린 리더는 이름 "완료"와 체크 상태를 읽는다. 보통 항목은 지금처럼 `<li>`다.

#### Scenario: 할 일 항목과 보통 항목이 섞인 목록

- **WHEN** 항목 `할 일`(`checked: false`) · `끝`(`checked: true`) · `보통`인 점 목록을 렌더한다
- **THEN** 출력이 `<ul><li class="post-task"><p><input type="checkbox" disabled aria-label="완료">할 일</p></li><li class="post-task"><p><input type="checkbox" disabled checked aria-label="완료">끝</p></li><li><p>보통</p></li></ul>`다
