## ADDED Requirements

### Requirement: get_writing_guide는 워크스페이스 글쓰기 가이드를 함께 준다

`get_writing_guide`는 SHALL 형식 가이드 뒤에 워크스페이스 설정의 글쓰기 가이드를 붙여 돌려준다. 가이드가 비어 있으면 형식 가이드만이다.

#### Scenario: 저장한 가이드가 형식 가이드 뒤에 붙는다

- **WHEN** 설정에 가이드를 저장한 뒤 `get_writing_guide`를 부른다
- **THEN** 응답이 형식 가이드로 시작하고 저장한 가이드를 담는다
