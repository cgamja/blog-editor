## ADDED Requirements

### Requirement: 세션 만료를 스스로 알리는 mutation의 401은 세션을 바꾸지 않는다

web의 QueryClient는 SHALL `meta.expiresSessionOnUnauthorized`가 `false`인 mutation이 `UnauthorizedError`로 실패하면 세션 캐시를 바꾸지 않는다 — 그 화면(편집 화면 저장)이 띠로 알리고 쓰던 글을 두고 떠나지 않는다. 그 밖의 401은 지금처럼 로그인 필요로 바꾼다.

#### Scenario: 편집 화면 저장의 401

- **WHEN** `meta.expiresSessionOnUnauthorized: false`인 mutation이 `UnauthorizedError`로 실패한다
- **THEN** 세션은 로그인됨 그대로다
