# Design — move-block (이슈 #43)

## 0. 공식 커맨드가 없는 것 확인(adr-017 재검토 조건)

대응하는 공식 커맨드 · 확장 없음. 확인한 곳: prosemirror-commands 1.7.2 export 목록(`joinUp` · `joinDown` · `lift` 등 — 블록 순서 바꾸기 없음), @tiptap/core 3.31.3 `src/commands/`(`insertContentAt` · `deleteNode` 등 — move 없음), tiptap.dev 공식 확장 목록(블록 이동 확장 없음, 끌기용 DragHandle은 별도 범위). 그래서 직접 짠다.

## 1. 대상 범위 — 선택이 걸친 최상위 블록

`$from.index(0)`이 시작 블록이다(https://prosemirror.net/docs/ref/#model.ResolvedPos.index). 끝은 `$to`로 정하는데 두 경우는 `$to.index(0)`의 블록을 **빼고** 센다.

- `$to.depth === 0` — 노드 선택의 끝은 블록 뒤 경계다
- 선택이 비어 있지 않고 `$to`가 다음 최상위 블록의 첫 글자 자리(블록부터 텍스트 블록까지 첫째 자식을 따라 내려와 `parentOffset === 0`) — 드래그가 다음 블록 맨 앞에 걸친 경우. VS Code 줄 이동과 같이 그 블록은 옮기지 않는다

깊이 0의 빈 선택은 GapCursor(블록 사이 커서, https://prosemirror.net/docs/ref/#gapcursor)다. gap 바로 뒤 블록 하나를, 문서 끝 gap이면 앞 블록 하나를 범위로 잡는다 — 커서가 붙어 보이는 블록을 옮기는 것이 자연스럽다. 이 처리가 없던 첫 구현은 문서 끝 gap에서 `RangeError: Index 2 out of range`로 깨졌다. `AllSelection`은 범위가 문서 전체라 이웃이 없어 `false`다. 커서가 목록 · 인용 · 콜아웃 안이면 깊이 0 인덱스가 그 최상위 블록을 가리키므로 안쪽 블록 옮기기는 범위 밖이다(목록 항목은 schema-list의 lift/sink 몫).

## 2. 트랜잭션 — 이웃 하나를 지우고 반대편에 넣는다

범위를 들지 않고 **이웃 블록 하나**를 지우고(`tr.delete`) 반대편에 다시 넣는다(`tr.insert`). 방향별 차이(이웃 인덱스 · 넣을 자리 · 움직인 거리)는 `planUp` · `planDown` 두 함수가 계산하고, delete · insert · dispatch는 한 곳에 둔다. 한 트랜잭션이라 history에서 한 번에 되돌아간다(https://prosemirror.net/docs/ref/#history.undo). 옮기는 노드를 건드리지 않으므로 attrs · 스티커가 바뀔 틈이 없다(adr-008). 근거: https://prosemirror.net/docs/ref/#transform.Transform.delete · https://prosemirror.net/docs/ref/#transform.Transform.insert

## 3. 선택 — 옮긴 거리만큼 평행 이동

옮긴 범위 안의 위치(와 범위 경계의 gap, 빠진 다음 블록 첫 글자 자리)는 모두 이웃 크기만큼 한 방향으로 움직였다. `state.selection.map(tr.doc, StepMap.offset(shift))`로 옮긴다(https://prosemirror.net/docs/ref/#state.Selection.map · https://prosemirror.net/docs/ref/#transform.StepMap^offset). 선택 클래스마다 자기 map 규칙을 쓰므로 텍스트 · 노드 · GapCursor를 분기하지 않는다 — GapCursor는 옮긴 자리가 유효한 gap(양쪽이 닫힌 블록)이면 gap으로, 아니면 `Selection.near`로 가까운 커서가 된다. 트랜잭션 기본 매핑(`tr.selection`)은 텍스트 · 노드 선택에는 맞지만, 범위 경계에 선 gap을 지운 · 넣은 이웃 쪽에 남겨 블록에서 떼어 놓는다.

## 4. 단축키 — 표를 export, 양 끝에서도 키를 삼킨다

`moveBlockKeymap`은 prosemirror-keymap `keymap()`이 받는 모양(https://prosemirror.net/docs/ref/#keymap.keymap)이다. 키는 Notion과 같은 `Mod-Shift-ArrowUp/Down`(`Mod` = macOS Cmd, 그 밖 Ctrl). 핸들러는 커맨드를 부른 뒤 **늘 `true`** 를 돌려 키를 삼킨다 — 커맨드 자체는 옮길 수 없으면 `false`라 `can()`은 맞게 나오지만, 키가 빠져나가면 macOS의 "Cmd-Shift-Up = 문서 끝까지 선택"이 뜻밖에 실행된다. 에디터 안에서는 OS 기본 선택 확장을 덮어쓰는 셈이다. TipTap 확장 `MoveBlock`은 `addProseMirrorPlugins`로 keymap 플러그인을 싣는다(https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension). `addKeyboardShortcuts`는 `({ editor }) => boolean` 모양이라 쓰지 않았다. `editorExtensions`(스키마 목록)에는 넣지 않는다 — 에디터를 조립하는 editor-react가 고른다.

## 5. 결과 검사

커맨드 안에서 `docFromNode`(zod)를 돌리지 않는다 — 최상위 블록 순서만 바꾸므로 닫힌 집합을 어길 수 없고(최상위 블록끼리 순서 제약 없음), 편집 중 방어는 blockGuard(#41) 몫이다. 테스트가 결과마다 `docFromNode` 통과를 단언한다.
