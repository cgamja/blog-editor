# web-app-shell Specification

## Purpose

로그인한 화면의 틀(왼쪽 메뉴 · 본문 자리)과 로그아웃. 편집처럼 전체 화면을 쓰는 화면은 틀 밖이다. 폴더 층(app → features → shared)은 docs/conventions.md "web 폴더 층".

## Requirements

### Requirement: 로그아웃은 캐시를 비우고 세션을 로그인 필요로 둔다

web은 SHALL 로그아웃할 때 쿼리 캐시를 모두 비우고 세션 캐시를 로그인 필요(`anonymous`)로 둔다 — 앞 계정의 목록이 남지 않고 가드가 로그인 화면으로 보낸다.

#### Scenario: 로그아웃 뒤 다른 쿼리가 없고 세션은 로그인 필요다

- **WHEN** 세션이 로그인됨이고 글 목록 쿼리가 캐시에 있을 때 로그아웃 캐시 처리를 한다
- **THEN** 글 목록 쿼리는 없고 세션은 로그인 필요다
