# editor-slash-menu Specification

## Purpose

키보드만으로 블록을 넣는 길 — Notion처럼 `/`를 치면 커서 아래에 블록 메뉴가 뜬다(이슈 #90). 목록은 블록 옆 「+」 메뉴와 같고, 이어 친 글자(한글은 자모 단위)로 거른다. 고르면 `/거르기`를 지우고 한 트랜잭션으로 블록을 바꾸거나 아래에 넣는다. 결정 근거는 `openspec/changes/archive/2026-09-24-slash-menu/design.md`.

## Requirements

### Requirement: `/`로 슬래시 메뉴를 연다

`@blog-editor/editor-core`는 SHALL `slashMenu()` 플러그인과 `slashMenuKey`를 export한다. 선택이 비어 있고 커서가 최상위 문단 안이며 커서 앞이 줄 맨 앞이거나 공백일 때 `/`를 치면, 상태가 `{ from, query: "" }`가 된다(`from`은 `/`의 위치). 코드 마크 안 · 목록 · 인용 · 콜아웃 · 제목 · 코드 블록 안이거나 앞 글자가 공백이 아니면 열리지 않고 `/`는 평소처럼 입력된다.

#### Scenario: 빈 문단 맨 앞에서 연다

- **WHEN** 빈 최상위 문단에서 `/`를 친다
- **THEN** 상태는 `{ from: 1, query: "" }`이고 문서에는 `/`가 있다

#### Scenario: 공백 뒤에서는 열고 글자 바로 뒤에서는 열지 않는다

- **WHEN** `가 ` 뒤에서 `/`, 또는 `a` 뒤에서 `/`를 친다
- **THEN** 앞은 열리고, 뒤는 열리지 않는다

#### Scenario: 목록 · 코드 블록 · 코드 마크 안에서는 열지 않는다

- **WHEN** 점 목록 항목, 코드 블록, 코드 마크가 걸린 자리에서 `/`를 친다
- **THEN** 셋 다 열리지 않는다

#### Scenario: 붙여넣기 · 되돌리기로 들어온 `/`는 열지 않는다

- **WHEN** handleTextInput을 거치지 않고 `/`가 들어온다, 또는 적용 뒤 undo로 `/제목`이 되살아난다
- **THEN** 둘 다 상태는 null이다

### Requirement: 이어 친 글자로 거른다

플러그인은 SHALL 트랜잭션마다 `/` 뒤부터 커서까지의 글자를 문서에서 다시 읽어 `query`로 둔다. 조합 입력처럼 handleTextInput을 거치지 않은 변경도 따라간다.

#### Scenario: 문서 변경으로 query가 바뀐다

- **WHEN** 연 뒤 `제목`을 입력 트랜잭션으로 넣는다(handleTextInput을 거치지 않음)
- **THEN** query는 `제목`이다

### Requirement: 닫아도 입력한 글자는 남는다

플러그인은 SHALL 다음이면 상태를 `null`로 돌린다. query에 공백 · 줄바꿈이 들어감, query가 20자 초과, `/`가 지워짐, 커서가 `/` 앞 · 다른 블록 · 범위 선택으로 감, Esc, `closeSlashMenu`. 어느 경우에도 문서의 글자는 지우지 않는다.

#### Scenario: 공백을 치면 닫힌다

- **WHEN** `/제` 뒤에 공백을 친다
- **THEN** 상태는 null이고 문서에는 `/제 `가 그대로 있다

#### Scenario: `/`를 지우면 닫힌다

- **WHEN** 연 직후 Backspace로 `/`를 지운다
- **THEN** 상태는 null이다

#### Scenario: Esc는 닫기만 한다

- **WHEN** `/제목` 상태에서 플러그인 handleKeyDown에 Escape
- **THEN** true를 돌려주고 상태는 null이며 `/제목`은 남는다

### Requirement: 방향키 · Enter · Tab은 UI 처리기로, 조합 중에는 넘기지 않는다

플러그인은 SHALL 열려 있을 때 ArrowUp · ArrowDown · Enter · Tab을 받은 처리기(`onKey`)에 넘기고 그 결과를 돌려준다. `view.composing`이거나 `event.isComposing`이면 넘기지 않고 false다. Shift · ⌘ · Ctrl · Alt가 눌렸으면 넘기지 않고 false다. 닫혀 있으면 어떤 키도 넘기지 않는다.

#### Scenario: 조합 중 Enter는 넘기지 않는다

- **WHEN** 열린 상태에서 composing인 뷰로 Enter
- **THEN** 처리기는 불리지 않고 false다. composing이 아니면 처리기가 불리고 그 반환값이 나온다

#### Scenario: 수정키 조합은 넘기지 않는다

- **WHEN** 열린 상태에서 Shift+Enter, ⌘+Shift+↓
- **THEN** 처리기는 불리지 않고 false다. 메뉴는 열린 채다

### Requirement: 항목을 고르면 `/거르기`를 지우고 블록을 바꾸거나 넣는다

`@blog-editor/editor-core`는 SHALL 커맨드 `applySlashItem(kind: InsertableBlockKind)`를 export한다. 한 트랜잭션으로 `/`부터 커서까지를 지우고, 그 문단이 비었으면 문단 자리를 `kind` 블록으로 바꾸고(문단의 꾸미기는 새 블록이 자리를 가진 것만 옮긴다), 글자가 남았으면 그 아래에 `kind` 블록을 넣는다. 「문단」은 지우기만 한다. 커서는 새 블록의 첫 글자 자리(글자가 없는 블록이면 뒤 문단)다. 메뉴가 닫혀 있거나 목록 밖 kind면 false다. 끝나면 메뉴는 닫힌다. 결과는 blockGuard를 통과하고 undo 한 번에 돌아간다. 적용 앞뒤로 되돌리기 묶음을 끊어, 적용 직후 친 글자는 따로 되돌아간다. 이어지는 커맨드가 거절하면 아무것도 지우지 않고 false다.

#### Scenario: 빈 문단의 `/제목`을 큰 제목으로

- **WHEN** 빈 문단에서 `/제목` 후 `applySlashItem("heading2")`
- **THEN** 그 블록은 글자 없는 h2이고 커서가 그 안에 있으며 메뉴는 닫혔다. undo 한 번이면 `/제목` 문단으로 돌아온다

#### Scenario: 꾸미기가 있는 빈 문단을 점 목록으로

- **WHEN** 스티커가 붙은 빈 문단에서 `/` 후 `applySlashItem("bulletList")`
- **THEN** 최상위 점 목록이 되고 스티커는 목록에 있다

#### Scenario: 글자가 남으면 아래에 넣는다

- **WHEN** `가 /콜` 뒤에서 `applySlashItem("calloutTip")`
- **THEN** 첫 문단은 `가 `이고, 바로 뒤에 tip 콜아웃이 있으며 커서가 그 안이다

#### Scenario: 빈 문단의 구분선

- **WHEN** 빈 문단에서 `/` 후 `applySlashItem("horizontalRule")`
- **THEN** 그 자리가 구분선이고 뒤 문단에 커서가 있다

#### Scenario: 닫혀 있으면 거절

- **WHEN** 메뉴가 닫힌 상태에서 `applySlashItem("heading2")`
- **THEN** false이고 문서는 그대로다

#### Scenario: 빈 문단에서 「문단」은 글자만 지운다

- **WHEN** 빈 문단 `/문`에서 `applySlashItem("paragraph")`
- **THEN** 빈 문단 하나이고 메뉴는 닫혔다

#### Scenario: 적용 뒤 친 글자는 따로 되돌아간다

- **WHEN** 빈 문단 `/제목`에서 `heading2`를 적용한 직후 `가`를 친다
- **THEN** undo 한 번이면 빈 h2, 두 번이면 `/제목` 문단이다

### Requirement: 슬래시 메뉴 목록과 키보드

editor-react는 SHALL 순수 함수 `filterSlashItems(query)`로 「+」 메뉴와 같은 목록(`INSERTABLE_BLOCKS` 순서)을 한글 이름(`INSERTABLE_BLOCK_LABELS`)과 영문 별칭(`SLASH_ALIASES`)의 부분 일치(대소문자 무시)로 거른다. 이름의 공백 · `·`은 빼고 비교한다. 한글은 자모로 풀어 비교한다 — 조합 중인 글자(`ㅈ`, `젬`)도 완성된 이름(`제목` = ㅈㅔㅁㅗㄱ)의 일부로 맞는다. `BlogEditor`는 SHALL 메뉴가 열리면 커서 아래에 listbox를 띄우고, 에디터 포커스를 둔 채 `aria-activedescendant`로 고른 항목을 알리며, ↑↓로 옮기고 Enter · Tab으로 적용하고 Esc로 닫는다. 일치 항목이 없으면 닫는다. 실브라우저로 확인한다.

#### Scenario: 한글 이름과 영문 별칭으로 거른다

- **WHEN** `filterSlashItems("제목")`, `filterSlashItems("h2")`, `filterSlashItems("HR")`, `filterSlashItems("")`, `filterSlashItems("없는말")`
- **THEN** 큰 제목 · 작은 제목, 큰 제목, 구분선, 전체 10개, 빈 목록이다

#### Scenario: 조합 중인 한글로도 거른다

- **WHEN** `filterSlashItems("ㅈ")`, `filterSlashItems("젬")`, `filterSlashItems("으")`
- **THEN** 앞 둘은 큰 제목 · 작은 제목(과 ㅈ이 든 다른 이름)을 포함하고, 셋째는 콜아웃 · 주의를 포함한다

#### Scenario: 키보드로 고른다

- **WHEN** 실브라우저에서 빈 문단에 `/h`를 치고 ↓ 뒤 Enter
- **THEN** 걸러진 목록의 둘째 항목이 적용되고 `/h`는 사라진다

#### Scenario: 띄어 쓰지 않은 이름으로도 거른다

- **WHEN** `filterSlashItems("큰제목")`, `filterSlashItems("점목록")`, `filterSlashItems("콜아웃메모")`
- **THEN** 큰 제목, 점 목록, 콜아웃 · 메모다
