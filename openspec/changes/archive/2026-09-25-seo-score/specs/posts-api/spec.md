## MODIFIED Requirements

### Requirement: 목록과 한 편 조회는 초안을 포함하고 ETag를 준다

`GET /api/posts`는 SHALL 초안을 포함한 모든 글의 요약(`slug` · `title` · `description` · `date` · `updated?` · `category` · `draft` · `source`)을 `date` 최신순으로 준다. `description`은 발행 확인의 설명 중복 점검에 쓴다(adr-034). 공개 조회(`/public/posts`)와 그 계약은 바뀌지 않는다. `GET /api/posts/:slug`는 글 파일 JSON과 `ETag` 헤더(따옴표로 감싼 revision)를 준다. 없는 글은 404, slug 모양이 아니면(`..` · 대문자 등) 400이다.

#### Scenario: 목록에 초안과 발행 글이 모두 최신순으로 나온다

- **WHEN** 초안 하나와 발행 글 둘을 저장한 뒤 `GET /api/posts`를 부른다
- **THEN** 200이고 세 글이 `date` 내림차순이며 초안의 `draft`는 `true`다

#### Scenario: 목록 요약에 설명이 있다

- **WHEN** 글 하나를 저장한 뒤 `GET /api/posts`를 부른다
- **THEN** 요약의 `description`이 저장한 설명이다

#### Scenario: 한 편 조회는 ETag를 주고 없는 글 · 잘못된 slug는 거절한다

- **WHEN** 저장된 글, 없는 slug, `Bad..Slug`를 각각 조회한다
- **THEN** 차례로 200 + `ETag: "<revision>"`, 404, 400이다
