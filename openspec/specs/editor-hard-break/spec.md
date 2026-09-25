# editor-hard-break Specification

## Purpose

문단 안 강제 줄바꿈(Shift+Enter · 줄 끝 `\`)을 에디터에서 넣고 다룬다(adr-028). 문단에만 두고 제목 · 표 칸에는 두지 않으며, 붙여넣기 · 끌어 놓기 · 블록 바꾸기에서 줄바꿈이 들어갈 수 없는 자리는 공백 하나로 바꾼다.

## Requirements

### Requirement: 문단에서 Shift+Enter는 강제 줄바꿈을 넣는다

editor-core는 SHALL 순수 커맨드 `insertHardBreak(state, dispatch)`를 export한다.

- 커서(또는 선택)가 문단 안이고 그 문단이 표 칸 안이 아니면, 선택을 `hardBreak` 하나로 바꾸고 true를 돌려준다.
- 강제 줄바꿈 자신은 선택 자리의 마크를 물려받지 않는다. `hardBreak`에는 마크가 없다(adr-028).
- 다음 줄에 이어 칠 글자는 마크를 잇는다(TipTap HardBreak `keepMarks` 기본과 같다). 저장된 마크를 쓰고, 없으면 줄 맨 앞이 아닐 때 선택 자리의 마크를 저장된 마크로 둔다(`ensureMarks`).
- 그 밖의 자리(제목 · 코드 블록 · 표 칸 · 노드 선택 · 여러 블록에 걸친 선택)에서는 dispatch 없이 false다.

#### Scenario: 문단 가운데 Shift+Enter

- **WHEN** 문단 `가나` 사이에 커서를 두고 `insertHardBreak`를 실행한다
- **THEN** 문단이 `가` · `hardBreak` · `나`이고 커서는 `나` 앞이다

#### Scenario: 굵은 글자 뒤 강제 줄바꿈에는 마크가 없다

- **WHEN** 굵은 `가` 끝에서 `insertHardBreak`를 실행하고 저장 경계(`docFromNode`)를 지난다
- **THEN** 결과가 `docSchema`를 통과하고 `hardBreak`에 `marks`가 없다

#### Scenario: 굵은 글자 뒤 강제 줄바꿈 다음 글자도 굵다

- **WHEN** 굵은 `가` 끝에서 `insertHardBreak`를 실행하고 `나`를 친다
- **THEN** 저장 결과가 굵은 `가` · `hardBreak` · 굵은 `나`다

#### Scenario: 제목 · 코드 블록 · 표 칸에서는 false

- **WHEN** 제목 안, 코드 블록 안, 표 칸 안에서 각각 `insertHardBreak`를 실행한다
- **THEN** 세 경우 모두 false이고 문서가 그대로다

### Requirement: Shift+Enter는 문단 밖에서 Enter와 같고 표 칸에서는 삼킨다

editor-core는 SHALL Shift+Enter 키에 순수 커맨드 `hardBreakOrEnter(state, dispatch)`를 건다. 차례대로 시도한다.

1. `insertHardBreak`(문단)
2. 표 칸이면 문서를 바꾸지 않고 삼킨다(칸 안은 문단 하나라 Enter도 삼킨다)
3. 목록 Enter(`enterInList`)
4. 스티커를 한 블록에만 두는 나누기
5. TipTap 코어 Enter 순서(`newlineInCode` · `createParagraphNear` · `liftEmptyBlock` · `splitBlock`)
6. 아무도 받지 않으면 문서를 바꾸지 않고 삼킨다

그래서 제목은 나뉘고, 코드 블록은 줄바꿈 글자를 받는다. 브라우저 기본 줄바꿈(contenteditable의 `<br>` 삽입)에는 끝까지 맡기지 않는다.

한글 조합 중에는 키를 받지 않는다. prosemirror-view 1.42.5 `editHandlers.keydown`이 handleKeyDown 전에 `inOrNearComposition(view)`로 버린다. 버리는 경우는 `view.composing`일 때, 그리고 Safari(WebKit)에서 compositionend 뒤 500ms 안에 온 keydown 한 번이다.

#### Scenario: 표 칸에서는 삼킨다

- **WHEN** 표 칸 안에서 `hardBreakOrEnter`를 실행한다
- **THEN** true이고 문서가 그대로다

#### Scenario: 제목 끝에서는 제목이 끝난다

- **WHEN** 제목 `제목` 끝에서 `hardBreakOrEnter`를 실행한다
- **THEN** 제목 `제목` 뒤에 빈 문단이 생긴다

#### Scenario: 코드 블록에서는 줄바꿈 글자가 들어간다

- **WHEN** 코드 블록 `code` 끝에서 `hardBreakOrEnter`를 실행한다
- **THEN** 코드 글자가 `code\n`이다

#### Scenario: 목록 항목 둘에 걸친 선택도 키를 받는다

- **WHEN** 목록 항목 `하나` · `둘`에 걸친 선택에서 `hardBreakOrEnter`를 실행한다
- **THEN** 앞의 커맨드가 모두 받지 않아 마지막 삼키기가 받는다 — true이고 문서가 그대로다

### Requirement: 강제 줄바꿈에 걸친 선택에도 마크를 붙일 수 있다

강제 줄바꿈에 걸친 선택에 마크를 붙이면, 마크 붙이기가 원자 인라인 노드인 `hardBreak`에도 마크를 싣는다. prosemirror-transform 1.12.1 `addMark` · `AddMarkStep`은 노드 자신이 아니라 부모의 `allowsMarkType`만 본다. NodeSpec `marks`는 그 노드 안쪽의 규칙이라 막지 못한다.

그래서 저장 경계(`docFromNode`)는 SHALL `hardBreak`의 마크를 지운다. 마크 붙이기가 blockGuard에 막혀 문서가 그대로 남으면 안 된다.

#### Scenario: 굵게 · 링크 · 글자색

- **WHEN** 문단 `가` · `hardBreak` · `나` 전체에 굵게, 링크 `/a`, 글자색 `brand`를 각각 붙인다(blockGuard 켬)
- **THEN** 세 경우 모두 문서가 바뀌고 `docFromNode` 결과가 `docSchema`를 통과한다

#### Scenario: toggleMark

- **WHEN** 같은 선택에서 `toggleMark(bold)`를 실행한다
- **THEN** 저장 결과가 굵은 `가` · `hardBreak`(마크 없음) · 굵은 `나`다

### Requirement: 블록 바꾸기에서 강제 줄바꿈은 자리에 맞게 바뀐다

`turnIntoTextblock`(블록 메뉴 · `#`/` ``` ` 입력 규칙이 쓴다)은 SHALL 강제 줄바꿈을 바꿀 블록의 자리에 맞춘다.

- 문단 → 코드 블록: 강제 줄바꿈이 줄바꿈 글자가 된다. `hardBreak`는 `linebreakReplacement`이고, prosemirror-transform 1.12.1 `setBlockType`이 바꾼다.
- 여러 줄 코드 블록 → 문단: 줄마다 문단 하나가 된다(editor-markdown-shortcuts의 기존 동작).
- 문단 → 제목: 강제 줄바꿈이 공백 하나가 된다. 제목에는 자리가 없고, `setBlockType`에 맡기면 지워져 두 줄 글자가 붙는다. 공백은 양쪽 글자가 함께 가진 마크를 가진다(굵은 두 줄이면 굵은 한 줄). 한쪽이 글자가 아니면 강제 줄바꿈 자신의 마크를 가진다.

#### Scenario: 문단 → 코드 블록

- **WHEN** 문단 `가` · `hardBreak` · `나`를 `turnIntoTextblock("codeBlock")`으로 바꾼다
- **THEN** 코드 글자가 `가\n나`다

#### Scenario: 여러 줄 코드 블록 → 문단

- **WHEN** 코드 블록 `가\n나`를 `turnIntoTextblock("paragraph")`로 바꾼다
- **THEN** 문단 `가` · 문단 `나` 둘이 된다

#### Scenario: 문단 → 제목

- **WHEN** 문단 `첫 줄` · `hardBreak` · `둘째 줄`을 `turnIntoTextblock("heading", { level: 2 })`로 바꾼다
- **THEN** 제목 글자가 `첫 줄 둘째 줄`이다

#### Scenario: 굵은 두 줄 문단 → 제목

- **WHEN** 굵은 `가` · `hardBreak` · 굵은 `나` 문단을 제목으로 바꾼다
- **THEN** 제목 글자가 굵은 `가 나` 하나다
