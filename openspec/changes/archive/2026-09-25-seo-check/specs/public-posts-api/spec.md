## ADDED Requirements

### Requirement: 공개 조회에는 핵심 검색어가 나가지 않는다

`GET /public/posts`는 SHALL 글 정보의 `keyword`를 응답에 싣지 않는다. 핵심 검색어는 에디터 안에서만 쓰는 저장 전용 값이다. 공개 계약(`createPublicPostsResponseSchema`)은 strict라, 새어 나가면 계약 재검사가 실패한다.

#### Scenario: keyword가 있는 발행 글도 공개 응답에는 keyword가 없다

- **WHEN** `keyword`가 있는 발행 글을 저장하고 `GET /public/posts`를 부른다
- **THEN** 그 글 항목에 `keyword` 키가 없다
