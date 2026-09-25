## ADDED Requirements

### Requirement: 강제 줄바꿈은 br로 낸다

렌더러는 SHALL `hardBreak`를 속성 없는 `<br>`로 낸다. 문단 안 다른 인라인과 같은 자리에 둔다.

#### Scenario: 문단 안 br

- **WHEN** 문단 `가` · `hardBreak` · `나`(bold)를 렌더한다
- **THEN** `<p>가<br><strong>나</strong></p>`가 나온다
