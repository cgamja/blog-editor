## ADDED Requirements

### Requirement: 할 일 항목은 글머리 기호 대신 체크 칸을 보인다

CSS는 SHALL `.post-task`의 글머리 기호를 지우고(`list-style: none`), 체크 칸(`.post-task > p > input[type="checkbox"]`)을 글머리 기호 자리(글 왼쪽)에 둔다. 값은 토큰만 쓴다.

#### Scenario: 할 일 어휘에 규칙이 있다

- **WHEN** `post.css`를 읽는다
- **THEN** `.post-task` 규칙에 `list-style: none`이, 체크 칸 규칙에 `input[type="checkbox"]` 선택자가 있다
