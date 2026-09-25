## ADDED Requirements

### Requirement: 글 정보는 저장 전용 핵심 검색어를 선택으로 가진다

글 정보(meta)는 SHALL 선택 칸 `keyword`를 가진다. 값은 앞뒤 공백을 뺀 1~`KEYWORD_MAX_LENGTH`자 문자열이다. SEO 검사가 제목 · 첫 문단과 대조하는 데만 쓰는 저장 전용 값이다. 선택 칸을 더한 것이라 기존 파일은 그대로 유효하고, `schemaVersion`은 1 그대로다.

#### Scenario: keyword가 없어도, 있어도 유효하다

- **WHEN** `keyword`가 없는 글 정보와 `keyword: "봄 산책"`인 글 정보를 검증한다
- **THEN** 둘 다 통과하고, 빈 문자열이나 상한을 넘는 `keyword`는 거부한다
