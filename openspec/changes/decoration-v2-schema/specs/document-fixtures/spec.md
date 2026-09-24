## MODIFIED Requirements

### Requirement: 유효 픽스처 셋은 스키마와 정규형을 통과한다

`fixtures`는 SHALL `PostFile` 세 개를 담는다.

- `minimal`: 문단 하나
- `allBlocks`: 모든 블록 · 마크 한 번씩
- `decorationMax`: Lighthouse용 — 글씨체 3종 · 움직임 · 폭 · 정렬 · 스티커 12개 · 글자 스타일(글꼴 · 두께 · 크기 · 프리셋 색 · hex 색 · 배경)

메타는 `categories: ["studio", "parenting", "parenting-assistant"]`(사이트 `BLOG_CATEGORIES`)로 검증 가능해야 한다.

#### Scenario: 세 픽스처가 파싱 · 정규형 · 현재 버전을 만족한다

- **WHEN** 각 픽스처를 `createPostFileSchema({ categories })`로 파싱하고 `normalize(doc)`와 비교한다
- **THEN** 셋 모두 `success === true`, `normalize(doc)`가 `doc`과 deep-equal(이미 정규형), `schemaVersion === SCHEMA_VERSION`

#### Scenario: allBlocks는 정말 모든 종류를 한 번 이상 쓴다

- **WHEN** `allBlocks.doc`를 순회해 노드 `type`과 마크 `type`을 모은다
- **THEN** 다음이 전부 나타난다
  - 노드 12종(`doc` 제외): 최상위 블록 10 + `listItem` + `text`
  - 마크 7종
