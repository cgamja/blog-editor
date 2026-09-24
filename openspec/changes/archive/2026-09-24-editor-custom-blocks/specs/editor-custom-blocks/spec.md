## ADDED Requirements

### Requirement: 콜아웃을 넣고 종류를 바꾼다

editor-core는 SHALL `insertCallout(tone)`과 `setCalloutTone(tone)` 커맨드를 export한다. `insertCallout`은 커서를 품은 최상위 블록이 빈 문단(꾸미기 attrs 없음)이면 그 자리를, 아니면 그 블록 뒤를 빈 문단 하나가 든 콜아웃으로 채우고 커서를 그 안에 둔다. 커서가 문서 끝 틈(gap cursor)이면 문서 끝에 넣는다. 커서가 이미 콜아웃 안이거나 `tone`이 `CALLOUT_TONES` 밖이면 `false`다. `setCalloutTone`은 커서를 품은 콜아웃의 `tone`만 바꾼다. 결과 문서는 항상 `docFromNode`를 통과한다.

#### Scenario: 빈 문단에서 넣으면 그 자리가 콜아웃이 된다

- **WHEN** 빈 문단에서 `insertCallout("tip")`을 실행한다
- **THEN** 그 자리에 `tone: "tip"` 콜아웃(빈 문단 하나)이 있고 커서가 그 안에 있다

#### Scenario: 글이 있는 문단에서 넣으면 뒤에 들어간다

- **WHEN** 글이 있는 문단에서 `insertCallout("note")`를 실행한다
- **THEN** 원래 문단은 그대로이고 바로 뒤에 콜아웃이 있다

#### Scenario: 꾸미기가 붙은 빈 문단은 바꾸지 않고 뒤에 넣는다

- **WHEN** `font`가 붙은 빈 문단에서 `insertCallout("note")`를 실행한다
- **THEN** 그 문단은 그대로이고 바로 뒤에 콜아웃이 있다

#### Scenario: 문서 끝 틈에서 넣으면 문서 끝에 들어간다

- **WHEN** 앱 스크린샷으로 끝나는 문서의 끝 틈(gap cursor)에서 `insertCallout("note")`를 실행한다
- **THEN** 문서 마지막 블록이 콜아웃이다

#### Scenario: 넣을 수 없으면 문서를 바꾸지 않는다

- **WHEN** 콜아웃 안에서 `insertCallout("note")`를, 또는 문단에서 `insertCallout("bogus")`를 실행한다
- **THEN** 커맨드가 `false`이고 문서가 그대로다

#### Scenario: 종류를 바꿔도 꾸미기는 남는다

- **WHEN** `font`가 있는 콜아웃 안에서 `setCalloutTone("warning")`을 실행한다
- **THEN** `tone`만 `"warning"`으로 바뀌고 `font`는 그대로다

#### Scenario: 콜아웃 밖에서는 종류를 바꾸지 않는다

- **WHEN** 일반 문단에서 `setCalloutTone("warning")`을 실행한다
- **THEN** 커맨드가 `false`이고 문서가 그대로다

### Requirement: 앱 스크린샷을 넣는다

editor-core는 SHALL `insertAppScreenshot({ src, caption })` 커맨드를 export한다. 넣는 자리는 콜아웃과 같은 규칙이다. 넣은 뒤 바로 뒤 블록이 최상위 문단이면 그 맨 앞에, 아니면(없음 · 콜아웃 · 다른 블록) 빈 문단을 하나 더해 거기에 커서를 둔다. `src`가 이미지 경로 규칙을 어기거나 `caption`이 `CAPTION_MAX_LENGTH`를 넘으면 `false`다.

#### Scenario: 빈 문단에서 넣으면 그 자리가 스크린샷이 된다

- **WHEN** 두 문단 사이 빈 문단에서 `insertAppScreenshot`을 실행한다
- **THEN** 빈 문단 자리에 스크린샷이 있고 커서가 다음 문단 맨 앞에 있다

#### Scenario: 뒤가 문단이 아니면 이어 쓸 빈 문단이 생긴다

- **WHEN** 마지막 문단, 또는 콜아웃 바로 앞 문단에서 `insertAppScreenshot`을 실행한다
- **THEN** 스크린샷 바로 뒤에 빈 문단이 있고 커서가 그 빈 문단에 있다

#### Scenario: 규칙을 어긴 값은 넣지 않는다

- **WHEN** 절대 URL `src` 또는 `CAPTION_MAX_LENGTH`를 넘는 `caption`으로 실행한다
- **THEN** 커맨드가 `false`이고 문서가 그대로다

### Requirement: 커스텀 블록 바로 뒤 Backspace는 블록을 고른다

editor-core는 SHALL `backspaceAfterCustomBlock` 커맨드를 export한다. 빈 선택 커서가 최상위 블록(문단 · 제목 · 코드 · 목록 · 인용)의 첫 글자 자리에 있고 바로 앞 형제가 콜아웃 · 앱 스크린샷이면, 그 블록이 빈 문단(꾸미기 없음)일 때는 지우고 아니면 문서를 그대로 두며, 두 경우 모두 앞 블록을 노드 선택으로 고른다. 블록을 콜아웃 안으로 합치지 않는다. 그 밖은 `false`다.

#### Scenario: 빈 문단이면 지우고 앞 블록을 고른다

- **WHEN** 콜아웃 바로 뒤 빈 문단 맨 앞에서 실행한다
- **THEN** 빈 문단이 없어지고 콜아웃이 노드 선택이다

#### Scenario: 글이 있는 블록이면 합치지 않고 앞 블록만 고른다

- **WHEN** 콜아웃 · 앱 스크린샷 바로 뒤 문단, 또는 콜아웃 바로 뒤 제목 · 목록의 첫 글자 자리에서 실행한다
- **THEN** 문서가 그대로이고 앞 블록이 노드 선택이다

#### Scenario: 커스텀 블록 뒤 첫 글자 자리가 아니면 넘긴다

- **WHEN** 일반 문단 뒤 문단 맨 앞, 또는 콜아웃 뒤 문단의 중간에서 실행한다
- **THEN** 커맨드가 `false`이고 문서가 그대로다
