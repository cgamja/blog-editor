## ADDED Requirements

### Requirement: 감싸면 꾸미기가 바깥 블록으로 옮겨진다

editor-core는 SHALL `wrapInBlockquote` · `wrapInBulletList` · `wrapInOrderedList` · `wrapInCallout(tone)` 커맨드를 export한다. 최상위 블록을 감싸면 감싼 블록들의 `stickers`를 순서대로 모두 합쳐 바깥 블록에 두고, `font` · `motion`은 값이 있는 첫 블록의 것을 바깥 블록에 둔다. 안쪽이 된 블록에는 꾸미기가 남지 않는다. 감싸기와 옮기기는 한 트랜잭션이라 undo 한 번에 되돌아가고, 결과 문서는 `docFromNode`와 blockGuard를 통과한다.

#### Scenario: 꾸민 문단을 인용으로 감싸면 꾸미기가 인용으로 옮겨진다

- **WHEN** blockGuard를 단 에디터에서 `font` · 스티커가 붙은 최상위 문단에 `wrapInBlockquote`를 실행한다
- **THEN** 문서가 인용 하나로 바뀌고, 인용이 그 `font`와 스티커를 가지며, 안쪽 문단에는 꾸미기가 없다

#### Scenario: 여러 문단을 목록으로 감싸면 스티커가 모두 모인다

- **WHEN** 스티커가 붙은 문단 둘을 선택해 `wrapInBulletList` 또는 `wrapInOrderedList`를 실행한다
- **THEN** 바깥 목록이 두 문단의 스티커를 순서대로 모두 가지고, `font`는 값이 있는 첫 문단의 것이다

#### Scenario: 콜아웃으로 감싸면 종류와 꾸미기가 콜아웃에 있다

- **WHEN** `motion`이 붙은 최상위 문단에서 `wrapInCallout("tip")`을 실행한다
- **THEN** 바깥이 `tone: "tip"` 콜아웃이고 그 `motion`을 가지며, 안쪽 문단에는 꾸미기가 없다

#### Scenario: 안쪽에서 감싸면 새 블록에 꾸미기가 없다

- **WHEN** 콜아웃 안 문단에서 `wrapInBulletList`를 실행한다
- **THEN** 콜아웃 안에 목록이 생기고, 콜아웃의 꾸미기는 그대로이며, 새 목록에는 꾸미기가 없다

#### Scenario: 되돌리기 한 번에 감싸기 전으로 돌아간다

- **WHEN** 꾸민 문단을 `wrapInBlockquote`로 감싼 뒤 undo를 한 번 실행한다
- **THEN** 문서가 감싸기 전과 같다

#### Scenario: 감쌀 수 없으면 문서를 바꾸지 않는다

- **WHEN** 제목을 `wrapInBlockquote`로 감싸거나, 콜아웃 안에서 `wrapInCallout("tip")`을, 또는 `wrapInCallout("bogus")`를 실행한다
- **THEN** 커맨드가 `false`이고, dispatch 없이 물어도 `false`이며, 문서가 그대로다
