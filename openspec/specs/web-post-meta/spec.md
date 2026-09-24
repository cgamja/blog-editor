# web-post-meta Specification

## Purpose

편집 화면 글 정보 — 새 글 주소 제안(로마자 slug), 저장을 막는 빈칸, 화면이 스스로 옮긴 주소에서 편집 세션 이어 가기(이슈 #97).

## Requirements

### Requirement: 새 글 주소는 제목에서 로마자 slug로 제안한다

web은 SHALL `suggestSlug(title)`로 새 글 주소를 제안한다. 한글은 국어의 로마자 표기(소리 변화 없이 글자대로)로 옮기고, 소문자 · 숫자 밖은 하이픈 하나로 묶고 양끝 하이픈을 뗀다. 80자를 넘으면 80자 안의 마지막 단어 경계에서 자른다. 글자가 하나도 남지 않으면 빈 문자열이다.

#### Scenario: 한글 제목은 로마자로

- **WHEN** "신생아 수면 패턴"을 제안한다
- **THEN** `sinsaenga-sumyeon-paeteon`이다

#### Scenario: 영문 · 숫자 · 기호

- **WHEN** "Hello, World! 2026"을 제안한다
- **THEN** `hello-world-2026`이다

#### Scenario: 긴 제목은 단어 경계에서 80자 안으로

- **WHEN** 90자가 넘는 영문 제목을 제안한다
- **THEN** 80자 이하이고 하이픈으로 끝나지 않으며 slug 모양이다

#### Scenario: 글자가 없으면 빈 문자열

- **WHEN** "!!! ???"를 제안한다
- **THEN** 빈 문자열이다

### Requirement: 저장을 막는 빈칸을 알려 준다

web은 SHALL `missingForSave(meta, slug)`로 서버에 보내기 전 빈칸을 고른다. 제목 · 설명 · 카테고리가 공백뿐이면, 주소가 slug 모양이 아니면 그 칸을 순서대로 돌려준다.

#### Scenario: 막 만든 새 글

- **WHEN** 제목 · 설명 · 카테고리가 비고 주소가 빈 글을 본다
- **THEN** 제목 · 설명 · 카테고리 · 주소 순서다

#### Scenario: 다 채운 글

- **WHEN** 네 칸을 모두 맞게 채운 글을 본다
- **THEN** 빈 목록이다

### Requirement: 화면이 스스로 옮긴 주소에서는 편집 세션을 이어 간다

web은 SHALL `nextEditingSession(state, routeKey)`로 편집 세션 키를 정한다. 경로가 화면이 방금 옮긴(adopt) 주소면 세션 키를 그대로 두고, 그 밖의 경로 변화는 새 경로를 세션 키로 한다.

#### Scenario: 새 글이 처음 저장되어 주소가 생긴다

- **WHEN** 세션 `new`가 `hello`를 adopt한 뒤 경로가 `hello`가 된다
- **THEN** 세션 키는 `new` 그대로다

#### Scenario: 다른 글로 옮긴다

- **WHEN** 세션 `hello`에서 adopt 없이 경로가 `other`가 된다
- **THEN** 세션 키는 `other`다
