## ADDED Requirements

### Requirement: 미리보기는 공개 렌더러 그대로의 HTML을 로그인한 사람에게만 준다

`POST /api/preview`는 SHALL 본문 `{ doc }`를 문서 스키마로 검증하고, 정규화한 문서를 공개 API와 같은 렌더러 · `imageBaseUrl`로 그린 `{ html }`을 준다. 저장하지 않는다. 스키마를 어기면 400과 이슈 목록, 세션이 없으면 401이다.

#### Scenario: 공개 렌더러와 같은 HTML

- **WHEN** 로그인한 채 꾸미기가 든 문서로 미리보기를 부른다
- **THEN** 200이고 `html`이 그 문서를 `renderHtml`로 그린 것과 같다

#### Scenario: 스키마 밖 문서 · 로그인 없음은 거부된다

- **WHEN** 링크 `href`가 `javascript:alert(1)`인 문서로 부르고, 세션 없이 부른다
- **THEN** 차례로 400(이슈 경로에 `href`) · 401이다
