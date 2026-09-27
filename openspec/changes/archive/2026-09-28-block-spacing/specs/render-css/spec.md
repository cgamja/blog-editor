## ADDED Requirements

### Requirement: 간격 단계마다 위 여백 규칙이 있다

post.css는 SHALL `SPACES` 값마다 `[data-space="<값>"]` 선택자로 단계 여백(`--post-space`, em)을 두고, 앞 블록이 있을 때만(`.post-body > * + [data-space]`) 그 값을 위 여백으로 쓴다. 에디터 CSS도 같은 변수를 쓴다.

#### Scenario: 선택자와 규칙

- **WHEN** post.css에서 간격 값마다 선택자를 찾는다
- **THEN** `sm` · `lg` · `xl` 선택자가 모두 있고, `.post-body > * + [data-space]` 규칙이 `margin-top`을 정한다
