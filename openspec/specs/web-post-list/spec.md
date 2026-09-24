# web-post-list Specification

## Purpose

글 목록 화면(`/`)의 판정 — 탭 거르기 · 개수, 고친 날 순서 · 표기, AI가 올린 초안 표시, 목록 대화상자(`?dialog=`) 이름. 화면 모양은 Figma 66:2와 결정 아티팩트 2(빈 목록 A안)가 원천이고, 가져오기 · AI로 쓰기 대화상자는 #98이 `dialogs`로 꽂는다.

## Requirements

### Requirement: 글 목록은 탭으로 거르고 탭마다 개수를 보인다

web은 SHALL 글 목록을 `?tab=` 값(전체 · 초안 · 발행됨)으로 거르고 세 탭의 개수를 함께 보인다. 모르는 탭 값은 전체다.

#### Scenario: 탭 개수

- **WHEN** 초안 2편 · 발행 1편의 개수를 센다
- **THEN** 전체 3 · 초안 2 · 발행됨 1이다

#### Scenario: 탭으로 거르기

- **WHEN** 같은 목록을 초안 탭 · 발행됨 탭으로 거른다
- **THEN** 초안 탭은 초안만, 발행됨 탭은 발행 글만이다

#### Scenario: 탭 값 읽기

- **WHEN** `draft` · `published` · `x` · 값 없음을 읽는다
- **THEN** 초안 · 발행됨 · 전체 · 전체다

### Requirement: 고친 날 최신순으로 보이고 날짜는 월 · 일이다

web은 SHALL 글을 고친 날(`updated`, 없으면 `date`) 최신순으로 늘어놓고, 같으면 주소순이다. 고친 날은 "9월 21일" 모양으로 보인다.

#### Scenario: 고친 날 순서

- **WHEN** 고친 날이 9월 3일 · 9월 21일(updated) · 9월 21일(date만)인 글을 늘어놓는다
- **THEN** 9월 21일 두 편이 주소순으로 먼저, 9월 3일이 뒤다

#### Scenario: 고친 날 표기

- **WHEN** `2026-09-21`과 `2026-10-03`을 표기한다
- **THEN** `9월 21일` · `10월 3일`이다

### Requirement: AI가 올린 초안에만 포스트잇을 붙인다

web은 SHALL 출처가 에디터가 아니고(`source !== "editor"`) 초안인 글에만 "AI가 올린 초안" 표시를 붙인다.

#### Scenario: 출처와 초안 여부로 판정

- **WHEN** claude 초안 · token 출처 초안 · editor 초안 · claude 발행 글을 판정한다
- **THEN** 앞의 둘만 표시한다

### Requirement: 목록 대화상자는 알려진 이름만 연다

web은 SHALL `?dialog=` 값이 `import` · `write-ai`일 때만 그 대화상자를 연다. 그 밖의 값은 아무것도 열지 않는다.

#### Scenario: 대화상자 이름 읽기

- **WHEN** `import` · `write-ai` · `x` · 값 없음을 읽는다
- **THEN** 가져오기 · AI로 쓰기 · 없음 · 없음이다

### Requirement: 글 목록 응답은 항목마다 모양을 확인한다

web은 SHALL 글 목록 응답을 받으면 `posts` 배열의 항목마다 필드 형을 확인하고, 틀리면 몇 번째 항목의 어느 필드인지 말하는 오류를 던진다. 목록 한 줄의 키는 계약(`api/openapi.json` PostList)의 항목 속성 · 필수와 같다.

#### Scenario: 맞는 응답은 그대로

- **WHEN** 필드가 모두 맞는 두 항목의 응답을 확인한다
- **THEN** 두 항목이다

#### Scenario: 형이 틀린 항목은 위치와 필드를 말한다

- **WHEN** 두 번째 항목의 `draft`가 문자열인 응답을 확인한다
- **THEN** `posts[1].draft`를 말하는 오류다

#### Scenario: 목록 한 줄의 키는 계약과 같다

- **WHEN** web의 필수 · 선택 키를 계약 PostList 항목의 `properties` · `required`와 견준다
- **THEN** 같다
