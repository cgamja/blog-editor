# public-posts-api Specification

## Purpose

사이트 빌드가 부르는 공개 조회 엔드포인트(plan 3-6 · 3-10). 저장된 글 중 발행된 것만 `content-render`로 렌더해 public-posts-contract 모양으로 내보낸다.

## Requirements

### Requirement: 공개 조회는 발행된 글만 렌더해 계약 모양으로 준다 (보호 대상 — 고쳐서 통과시키지 않는다)

`GET /public/posts`는 SHALL 저장된 글 중 `draft: false`인 것만 `createPublicPostsResponseSchema`를 통과하는 모양으로 준다 — 메타(`source` 제외) + `renderHtml` 결과 + `postCssUrl`, 글은 `date` 오름차순(계약 픽스처 순서), 이미지 경로에는 설정한 이미지 주소를 붙인다. 초안은 어떤 경우에도 나오지 않는다. 응답에 짧은 캐시(`Cache-Control: public, max-age=60`)를 건다.

#### Scenario: 초안은 공개 조회에 나오지 않는다

- **WHEN** 발행 글 하나와 초안 하나를 저장하고 `GET /public/posts`를 부른다
- **THEN** 200이고 `posts`에는 발행 글 하나뿐이며 응답 전체가 공개 응답 스키마를 통과한다

#### Scenario: 대표 픽스처 셋의 응답은 계약 픽스처와 같다

- **WHEN** 대표 픽스처 3개를 계약 slug(`beta-open` · `feature-tour` · `decoration-max`)로 발행 상태로 저장하고 이미지 주소 `https://simsimeestudio.com`으로 `GET /public/posts`를 부른다
- **THEN** 응답 JSON이 `contract/public-api/public/posts`와 같다

### Requirement: 본문용 CSS를 postCssUrl에서 준다

`GET /public/post.css`는 SHALL `content-render`의 본문용 CSS를 `text/css`로 주고, 공개 조회 응답의 `postCssUrl`은 이 경로다.

#### Scenario: postCssUrl로 CSS를 받는다

- **WHEN** 공개 조회 응답의 `postCssUrl`을 GET한다
- **THEN** 200 · `Content-Type: text/css`이고 본문이 `content-render`의 `post.css`와 같다

실패 의미론: 해당 없음 — 읽기 전용 엔드포인트.
