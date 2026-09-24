# Design — editor-custom-blocks

## 1. 근거

ProseMirror `Command` = `(state, dispatch?, view?) => boolean` — 적용할 수 없으면 dispatch를 부르지 않고 `false`(https://prosemirror.net/docs/guide/#commands, https://prosemirror.net/docs/ref/#state.Command). 삽입은 `Transform.replaceWith` · `insert`, 속성 변경은 `setNodeMarkup`(https://prosemirror.net/docs/ref/#transform.Transform.setNodeMarkup), 위치 계산은 `ResolvedPos`의 `index` · `before` · `posAtIndex`(https://prosemirror.net/docs/ref/#model.ResolvedPos), 커서는 `TextSelection.create` · `Selection.findFrom` · `NodeSelection.create`(https://prosemirror.net/docs/ref/#state.Selection), 문서 끝 틈은 `GapCursor`(https://prosemirror.net/docs/ref/#gapcursor). 기본 Backspace 체인은 `deleteSelection → joinBackward → selectNodeBackward`(prosemirror-commands `baseKeymap`, https://prosemirror.net/docs/ref/#commands.baseKeymap) — 시그니처는 설치된 타입(@tiptap/pm 3.31.3의 prosemirror-state · transform · commands · model · gapcursor `index.d.ts`)으로 확인했다.

## 2. 어디에 넣나 — "최상위 블록" 기준

커서가 있는 **최상위 블록**(`$from.index(0)`)을 기준으로 한다. 목록 · 인용 안에 있어도 그 목록 · 인용 전체가 기준 블록이다(콜아웃 · 스크린샷은 최상위에만 올 수 있다 — content-schema). 그래서 목록 · 인용 안 빈 항목 · 빈 문단에서 넣어도 그 빈 칸은 그대로 남고 새 블록은 목록 · 인용 **뒤**에 들어간다 — 의도한 동작이다(안쪽 구조를 커맨드가 몰래 고치지 않는다).

- 기준 블록이 **빈 문단**(글 없음 · 꾸미기 attrs 없음)이면 그 자리를 새 블록으로 바꾼다. 꾸미기가 붙은 빈 문단은 사용자가 꾸민 자리라 바꾸지 않고 뒤에 넣는다
- 아니면 기준 블록 **뒤**에 넣는다(원래 글은 그대로)
- 커서가 문서 끝 틈(`GapCursor`, `$from.index(0) === childCount`)이면 기준 블록이 없다 — 문서 끝에 넣는다
- 커서가 이미 콜아웃 안이면 `insertCallout`은 `false`(콜아웃은 중첩되지 않는다 — 스키마가 막는 것을 커맨드가 먼저 거절)

## 3. 커서가 가는 곳

- 콜아웃: 새 콜아웃의 빈 문단 안
- 앱 스크린샷(atom): 바로 뒤가 최상위 문단이면 그 맨 앞. 아니면(없음 · 콜아웃 · 다른 블록) 빈 문단을 하나 더해 거기로 — 이미지를 넣고 바로 이어 쓸 수 있게

## 4. 커스텀 블록 바로 뒤 Backspace

빈 선택 커서가 최상위 블록의 **첫 글자 자리**(`Selection.findFrom(블록 앞, 1, true)`가 가리키는 곳 — 문단 · 제목 · 코드는 맨 앞, 목록 · 인용은 첫 항목 · 첫 문단 맨 앞)에 있고 바로 앞 형제가 콜아웃 · 앱 스크린샷일 때:

- 그 블록이 **빈 문단**(꾸미기 없음)이면 지우고 앞 블록을 `NodeSelection`으로 고른다(한 번 더 누르면 기본 체인의 `deleteSelection`이 블록을 지운다)
- 그 밖에는 문서를 바꾸지 않고 앞 블록만 고른다 — 합치지 않는다. 기본 `joinBackward`는 글을 콜아웃 마지막 문단에 붙이거나 목록을 콜아웃 안으로 들인다
- 그 밖(앞이 일반 블록, 첫 글자 자리가 아님, 선택 범위 있음)은 `false` — 키맵에서 기본 체인 **앞**에 걸어 두면 나머지는 기본 동작이 맡는다(키맵 등록은 editor-react)

**editor-react · #44로 넘기는 것**: 글이 있는 블록에서 첫 Backspace는 앞 블록을 **고르기만** 하고, 두 번째 Backspace가 그 블록 전체를 지운다. 그래서 노드 선택이 눈에 보여야 한다 — editor-react에서 `.ProseMirror-selectednode` 표시가 필수다. 실브라우저 체크리스트(#44)에 "커스텀 블록 뒤 Backspace 두 번: 첫 번째에 선택 표시가 보이고 두 번째에 지워진다" 항목을 넣는다.

## 5. 값 검증

`insertAppScreenshot`은 `src`를 content-schema `imagePathSchema`로, `caption` 길이를 `CAPTION_MAX_LENGTH`로 먼저 검사한다 — 어기면 `false`(zod가 저장 시점에 던지기 전에, 넣는 순간 거절). `tone`은 `CALLOUT_TONES`에 없으면 `false`.
