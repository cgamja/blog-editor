# Design — markdown-shortcuts

## 1. prosemirror-inputrules를 그대로 쓰고, 블록 변환은 우리 커맨드로

입력 규칙 엔진은 `@tiptap/pm/inputrules`(prosemirror-inputrules 1.5.1)의 `inputRules` · `InputRule` · `undoInputRule`을 쓴다. https://prosemirror.net/docs/ref/#inputrules

라이브러리의 `wrappingInputRule` · `textblockTypeInputRule`은 쓰지 않는다. 둘 다 새 노드를 기본 attrs로 만들어서 문단의 꾸미기(font · motion · stickers)를 잃거나(`setBlockType`에 attrs를 안 넘기면 스티커가 사라진다), 꾸미기가 안쪽 노드에 남아 blockGuard가 트랜잭션을 거부한다. 입력 규칙이 `true`를 돌려준 뒤 거부되면 입력한 글자까지 사라진다. 그래서 규칙 핸들러는 마크다운 표시 글자를 지운 트랜잭션 위에 기존 커맨드(`wrapInBulletList` 등, #55 — 꾸미기를 바깥 블록으로 옮긴다)와 새 `turnIntoTextblock`(꾸미기 중 새 노드가 가질 수 있는 것만 들고 간다)을 이어 붙인다. 커맨드가 `false`면 핸들러는 `null`을 돌려주고, 글자는 평범하게 입력된다.

## 2. 한글 조합

prosemirror-inputrules의 `run`은 `view.composing`이면 아무것도 하지 않고 `false`를 돌려준다(1.5.1 `dist/index.js` 92행). 조합이 끝나면 `compositionend`에서 커서 앞 글자로 규칙을 한 번 더 본다(78–83행). 그래서 조합 중인 글자가 규칙을 깨지 않는다. `- ` · `## `의 `-` · `#` · 공백은 조합 문자가 아니라 조합과 겹칠 일은 드물다. 실브라우저 확인은 #44 체크리스트 항목으로 둔다.

## 3. 블록 규칙은 최상위 문단 · 제목에서만

`- ` 같은 블록 규칙은 커서가 최상위 문단(또는 제목)의 맨 앞일 때만 건다. 목록 항목 · 인용 · 콜아웃 안에서 걸면 목록이 한 단계 들어가거나 인용이 겹쳐 Notion과 다른 결과가 난다. 그 자리에서는 글자가 평범하게 입력된다. 제목에서는 `## ` 같은 제목 규칙만 의미가 있고, 목록 · 인용 규칙은 커맨드가 `false`라 걸리지 않는다.

## 4. 블록 바꾸기는 꾸미기를 들고 간다

`turnIntoTextblock(type, attrs)`는 커서가 든 최상위 텍스트 블록을 바꾼다. 새 노드 타입이 가질 수 있는 꾸미기 키(`type.spec.attrs`에 있는 것)만 옛 노드에서 옮긴다. 예: 폰트가 있는 문단을 코드 블록으로 바꾸면 폰트는 떨어지고(코드 블록엔 자리가 없다) 움직임 · 스티커는 남는다. 코드 블록이 받을 수 없는 마크는 `setBlockType`이 지운다. https://prosemirror.net/docs/ref/#transform.Transform.setBlockType

## 5. `---`는 빈 문단 뒤에 구분선 + 새 문단

Notion처럼 `--`만 있는 최상위 문단에서 세 번째 `-`를 치면 그 문단 자리에 구분선을 넣고, 바로 뒤에 새 문단을 만들어 커서를 둔다. 새 문단은 옛 문단의 꾸미기를 받는다(스티커가 사라지지 않는다). 문단에 다른 글자가 있으면 걸지 않는다.

## 6. 인라인 마크 규칙

`**글자**` · `*글자*` · `` `글자` ``는 닫는 표시를 치는 순간 표시 글자를 지우고 마크를 건다. 한국어는 단어 앞에 공백이 없을 때가 많아서 여는 표시 앞에 공백을 요구하지 않는다. 대신 여는 표시 앞 글자가 같은 표시 문자면 걸지 않아 `**굵게*`에서 기울임이 먼저 걸리지 않는다. 마크를 건 뒤에는 저장된 마크를 지워 이어 치는 글자는 마크 없이 들어간다. 코드 마크 안 · 코드 블록 안에서는 걸지 않는다(`inCodeMark: false`, 기본 `inCode: false`).

## 7. 단축키

- ⌘B · ⌘I · ⌘E: `toggleMark` https://prosemirror.net/docs/ref/#commands.toggleMark
- ⌘⌥0 · 1 · 2 · 3 · 5 · 6 · 8: Notion "turn into" 번호. 우리 본문엔 h1이 없어서(글 제목이 h1) ⌘⌥1도 큰 제목(h2)이다. macOS에서 ⌥+숫자는 `event.key`가 특수 문자가 되지만 prosemirror-keymap이 keyCode로 기본 이름을 다시 찾는다(`keydownHandler`의 base 조회).
- ⌘D: 커서가 든 최상위 블록을 바로 뒤에 복제하고 커서를 복제본으로 옮긴다. 문서 스티커 수가 상한(12)을 넘으면 `false`.
- Backspace: 규칙 직후면 `undoInputRule`. 커스텀 블록 Backspace(우선순위 1000)보다 먼저 봐야 해서 확장 우선순위를 1100으로 둔다.
- ⌘K: 링크 입력 팝오버(editor-react). `window.prompt`는 쓰지 않는다. 주소는 content-schema `hrefSchema`(허용 목록)로 거르고, 어기면 팝오버 안에 이유를 보여 준다.
