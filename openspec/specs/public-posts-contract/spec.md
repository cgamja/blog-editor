# public-posts-contract Specification

## Purpose

TBD - created by archiving change public-posts-contract. Update Purpose after archive.

## Requirements

### Requirement: 공개 조회 응답은 닫힌 모양이다

`GET /public/posts`의 응답은 SHALL `createPublicPostsResponseSchema({ categories })`가 정의하는 모양만 가진다 — 최상위 `{ postCssUrl, posts }`, 글마다 `slug` · `title` · `description` · `date` · `updated?` · `category` · `draft` · `image?` · `html`. 메타 필드의 규칙은 저장 형식(`createPostMetaSchema`)과 같다. `postCssUrl`은 API 주소 기준으로 푸는 URL 참조(`new URL(postCssUrl, BLOG_API_URL)`)다. `image`는 호스트가 있는 `https:` 절대 URL이다(저장된 경로 앞에 이미지 주소를 붙인 것). `html`은 `<div class="post-body">`로 시작한다. 목록 안 `slug`는 겹치지 않는다. 저장에만 쓰는 필드(`source` 등)와 모르는 키는 응답에 없다. 사이트는 이 스키마를 import하지 않고 자기 zod로 같은 모양을 검증한다(두 레포 사이 코드 의존 없음).

#### Scenario: 모양이 맞는 응답은 통과한다

- **WHEN** 글 하나(`draft: false`, `html`이 `<div class="post-body">…`)를 담은 응답을 검증한다
- **THEN** 통과한다

#### Scenario: 모르는 키 · 겹치는 slug는 거부된다

- **WHEN** 글에 `source: "claude"`를 더한 응답, 같은 `slug`를 두 번 담은 응답, `image`가 `https:foo`(호스트 없음) · `http://…`인 응답을 각각 검증한다
- **THEN** 모두 실패한다

### Requirement: 공개 조회 응답에 초안이 없다 (보호 대상 — 고쳐서 통과시키지 않는다)

응답의 모든 글은 SHALL `draft: false`다. `draft: true`인 글이 하나라도 있으면 응답 전체가 검증에 실패한다 — 필드를 빼는 대신 `false`를 명시해 사이트가 같은 방어선(섞이면 빌드 실패)을 둘 수 있게 한다. 이 테스트를 통과시키기 위해 단언을 완화하지 않는다.

#### Scenario: 초안이 섞인 응답은 거부된다

- **WHEN** 발행 글 하나와 `draft: true`인 글 하나를 담은 응답을 검증한다
- **THEN** 실패하고, 실패 위치가 그 글의 `draft`다

### Requirement: 계약 픽스처는 렌더러 출력과 어긋나지 않는다

레포의 계약 픽스처 `contract/public-api/public/posts`(응답 JSON)와 `contract/public-api/public/post.css`는 SHALL 대표 픽스처 3개를 발행 상태로 바꿔 `renderHtml`로 렌더한 응답, 그리고 `@blog-editor/content-render/post.css`와 글자 하나까지 같다. 사이트는 이 디렉터리를 정적 서버로 띄워 `BLOG_API_URL`로 빌드한다(M1 API가 생기기 전의 계약). 렌더러나 CSS를 바꾸면 테스트가 실패하고, 픽스처는 `pnpm vitest run packages/content-render/src/contract.test.ts -u`로 다시 만든 뒤 diff를 사람이 본다.

#### Scenario: 픽스처가 렌더러 · CSS와 같다

- **WHEN** `fixtures` 3개(`minimal` · `allBlocks` · `decorationMax`)를 slug `beta-open` · `feature-tour` · `decoration-max`, `draft: false`, 이미지 주소 `https://simsimeestudio.com`(본문 `imageBaseUrl`과 `image` 둘 다)으로 응답을 만든다
- **THEN** 그 응답이 공개 조회 스키마를 통과하고, JSON(2칸 들여쓰기 + 끝 줄바꿈)이 `contract/public-api/public/posts`와 같고, `post.css` 사본이 원본과 같다

실패 의미론: 해당 없음 — 스키마와 픽스처. 응답을 만드는 API 핸들러는 M1.
