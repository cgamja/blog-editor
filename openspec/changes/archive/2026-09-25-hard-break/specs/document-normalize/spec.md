## ADDED Requirements

### Requirement: 문단 끝의 강제 줄바꿈은 정규형에서 지운다

`normalize`는 SHALL 문단(최상위 · 안쪽) 끝에 이어진 `hardBreak`를 모두 지운다. 그래서 문단이 비면 `content` 키를 지운다.

- 줄 끝 `\`는 뒤에 줄이 있어야 강제 줄바꿈으로 읽히므로, 끝의 강제 줄바꿈은 markdown으로 나를 수 없다.
- 공개 HTML에서도 끝의 `<br>`은 보이는 줄을 만들지 않는다.
- 문단 앞 · 가운데의 강제 줄바꿈과 이어진 강제 줄바꿈은 그대로 둔다. 인접한 텍스트는 강제 줄바꿈을 사이에 두면 합치지 않는다.

#### Scenario: 끝의 강제 줄바꿈만 지운다

- **WHEN** 문단 `hardBreak` · `가` · `hardBreak` · `hardBreak` · `나` · `hardBreak` · `hardBreak`를 `normalize`한다
- **THEN** 문단이 `hardBreak` · `가` · `hardBreak` · `hardBreak` · `나`가 된다

#### Scenario: 강제 줄바꿈뿐인 문단은 빈 문단이 된다

- **WHEN** 문단 `hardBreak` 하나를 `normalize`한다
- **THEN** `content` 키가 없는 문단이 된다
