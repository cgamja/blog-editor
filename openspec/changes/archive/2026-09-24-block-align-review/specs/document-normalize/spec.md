## ADDED Requirements

### Requirement: 기본 모양과 같은 정렬은 정규형에서 지운다

`normalize(doc)`는 SHALL 블록의 `align`이 그 블록 종류의 기본 모양과 같으면 지운다(⑤). 기본 모양은 content-schema `defaultAlignOf(type)`가 정한다 — 그림 · 앱 스크린샷은 `center`(폭을 줄이면 가운데 여백), 글 블록은 `left`. 에디터 커맨드도 같은 판정을 쓴다.

#### Scenario: 기본 모양 정렬이 지워진다

- **WHEN** 그림 align `center` · 문단 align `left`를 normalize한다
- **THEN** 두 블록 모두 align이 없다

#### Scenario: 기본이 아닌 정렬은 남는다

- **WHEN** 그림 align `left` · 문단 align `center`를 normalize한다
- **THEN** 값이 그대로 남는다

#### Scenario: 블록 종류별 기본 모양

- **WHEN** 그림 · 앱 스크린샷 · 문단 · 제목의 `defaultAlignOf`
- **THEN** `center` · `center` · `left` · `left`다

#### Scenario: 가져오기에서도 기본 정렬은 남지 않는다

- **WHEN** 이미지 앞 `{align=center}` · 문단 앞 `{align=left}`를 가져온다
- **THEN** 두 블록 모두 정렬 속성이 없다

#### Scenario: 직렬화에 기본 정렬 지시어가 나가지 않는다

- **WHEN** 그림 align `center` · 문단 align `left`가 든 문서를 직렬화한다
- **THEN** align 지시어가 없다
