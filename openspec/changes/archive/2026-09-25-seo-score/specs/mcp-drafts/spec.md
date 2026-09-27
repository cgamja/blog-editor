## MODIFIED Requirements

### Requirement: 쓰기 도구 응답에는 SEO 검사 결과가 늘 붙는다

`check_draft` · `create_draft` · `update_draft`는 SHALL 성공 응답에 `seo`와 `seoScore`를 싣는다. `seo`는 `checkSeo`의 발견 목록이고, 비교 대상(`others`)은 자기 글을 뺀 저장된 글들이다. `seoScore`는 그 목록의 `scoreSeo` 점수(0~100)다. AI가 가이드를 잊어도 저장할 때마다 고칠 거리와 점수를 받게 하려는 것이고, 검사 결과로 저장을 막지는 않는다. 비교 대상은 제목이 문자열인 목록 항목만 쓴다. 저장한 뒤 점검이 실패하면 `seo`와 `seoScore`를 `null`로 두고 저장 성공 응답을 그대로 준다.

- `create_draft` · `update_draft`는 `keyword`(핵심 검색어)를 선택 인자로 받아 글 정보에 저장한다. `update_draft`에서 `keyword`를 주지 않으면 원래 값을 지킨다.
- `check_draft`는 `title` · `description` · `keyword`가 함께 오면 그것까지 검사하고, 오지 않은 메타 규칙은 건너뛴다. `seoScore`도 건너뛴 뒤의 목록으로 계산한다. 그래서 메타를 모두 줘야 `create_draft` · `update_draft` 점수와 비교할 수 있다(도구 설명과 형식 가이드에 적는다).

#### Scenario: update_draft 응답의 seoScore

- **WHEN** `update_draft`로 제목만 고치고, 이어서 `edit`로 고친다
- **THEN** 두 응답 모두 `seoScore`가 그 응답 `seo`의 `scoreSeo` 점수다

#### Scenario: 저장 뒤 점검이 실패하면 seo · seoScore 둘 다 null

- **WHEN** 목록 읽기가 실패하는 저장소에서 `create_draft`를 부른다
- **THEN** 저장 성공 응답이고 `seo` · `seoScore`가 둘 다 `null`이다

#### Scenario: create_draft 응답에 seo가 있다

- **WHEN** alt가 빈 이미지가 든 markdown으로 `create_draft`를 부른다
- **THEN** 초안이 저장되고, 응답의 `seo`에 `image-alt` 발견이 있다

#### Scenario: 쓰기 도구 응답에 seo 점수가 있다

- **WHEN** alt가 빈 이미지가 든 markdown으로 `check_draft`와 `create_draft`를 부른다
- **THEN** 두 응답의 `seoScore`는 각각 그 응답 `seo`의 `scoreSeo` 점수이고, 100보다 작다

#### Scenario: 목록에 모양이 어긋난 항목이 있어도 저장 성공이다

- **WHEN** 목록 요약에 제목이 문자열이 아닌 항목이 섞인 저장소에서 `create_draft`를 부른다
- **THEN** 초안이 저장되고 응답이 도구 오류가 아니다

#### Scenario: keyword를 저장하고 update_draft는 없으면 지킨다

- **WHEN** `keyword`를 넣어 `create_draft`한 뒤 `keyword` 없이 `update_draft`한다
- **THEN** 저장된 글의 `meta.keyword`가 처음 값 그대로다
