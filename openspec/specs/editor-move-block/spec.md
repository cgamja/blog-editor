# editor-move-block Specification

## Purpose

최상위 블록을 위 · 아래로 옮기는 ProseMirror 순수 커맨드와 단축키(Mod-Shift-Arrow) — 한 트랜잭션으로 옮겨 undo 한 번에 되돌아가고, 스티커 등 블록 attrs가 그대로 따라간다(adr-008).

## Requirements

### Requirement: 최상위 블록을 이웃 블록과 자리 바꾼다

`@blog-editor/editor-core`는 SHALL ProseMirror 커맨드 `moveBlockUp` · `moveBlockDown`을 export한다. 옮기는 대상은 선택이 걸친 **최상위 블록 범위**다 — 안쪽 커서면 그 최상위 블록 전체, 여러 블록에 걸치면 범위 전체, 블록 사이 gap(GapCursor)이면 gap 바로 뒤 블록(뒤가 없으면 앞 블록)이다. 드래그 끝이 다음 블록의 첫 글자 자리에 걸친 선택은 그 블록을 빼고 센다. 범위는 바로 위(또는 아래) 최상위 블록과 자리 바꾸고, attrs(꾸미기 · 스티커 · 이미지 크기)는 그대로 따라가며, 선택은 옮긴 거리만큼 평행 이동한다(선택 종류별 map 규칙). 이웃이 없거나 범위가 문서 전체면 dispatch 없이 `false`다. 결과 문서는 `docFromNode`(zod)를 통과한다.

#### Scenario: 안쪽 커서면 최상위 블록 전체가 올라간다

- **WHEN** 문단 · 인용(안에 문단)에서 커서가 인용 안 문단 셋째 글자 앞이고 `moveBlockUp`을 부른다
- **THEN** 인용 · 문단 순서이고, 커서는 여전히 인용 안 문단 셋째 글자 앞이다

#### Scenario: 노드 선택한 블록이 내려가고 선택이 따라간다

- **WHEN** 이미지 · 문단에서 이미지를 노드 선택하고 `moveBlockDown`을 부른다
- **THEN** 문단 · 이미지 순서이고, 선택은 옮긴 이미지의 노드 선택이다

#### Scenario: 가운데 블록을 노드 선택해 올린다

- **WHEN** 문단 · 이미지 · 문단에서 이미지를 노드 선택하고 `moveBlockUp`을 부른다
- **THEN** 이미지가 첫째이고 선택은 그 이미지의 노드 선택이다

#### Scenario: 여러 블록에 걸친 선택은 범위째 옮긴다

- **WHEN** 문단 A · B · C에서 선택이 B 안에서 C 안까지 걸치고 `moveBlockUp`을 부른다
- **THEN** B · C · A이고, 선택 양 끝은 B · C 안의 같은 글자 위치다

#### Scenario: 드래그 끝이 다음 블록 첫 글자에 걸치면 그 블록은 빠진다

- **WHEN** 문단 A · B · C에서 선택이 B 안에서 C의 첫 글자 자리까지이고 `moveBlockUp`을 부른다
- **THEN** B · A · C이다

#### Scenario: gap 커서면 붙은 블록을 옮기고 gap이 따라간다

- **WHEN** 이미지 둘인 문서의 끝 gap에서 `moveBlockUp`을(또는 앞 gap에서 `moveBlockDown`을) 부른다
- **THEN** gap에 붙은 이미지가 옮겨지고, 선택은 옮긴 이미지 옆 gap이다

#### Scenario: 끝에서는 옮기지 않는다

- **WHEN** 첫 블록에서 `moveBlockUp`을, 마지막 블록에서 `moveBlockDown`을 부른다
- **THEN** 둘 다 `false`이고 dispatch가 불리지 않는다

#### Scenario: 전체 선택은 옮기지 않는다

- **WHEN** 전체 선택(AllSelection)에서 두 커맨드를 부른다
- **THEN** 둘 다 `false`다

#### Scenario: 꾸미기 · 스티커가 그대로 따라간다

- **WHEN** `decorationMax`에서 스티커가 붙은 블록을 한 칸 옮긴다
- **THEN** 그 블록 attrs가 옮기기 전과 같고, 결과 문서가 `docFromNode`를 통과한다

#### Scenario: 한 번 되돌리기로 원래대로

- **WHEN** history 플러그인이 있는 상태에서 `moveBlockDown` 뒤 `undo`를 한 번 부른다
- **THEN** 문서가 옮기기 전과 같다

### Requirement: 단축키는 Mod-Shift-화살표이고 양 끝에서도 키를 삼킨다

`moveBlockKeymap`은 SHALL `Mod-Shift-ArrowUp` · `Mod-Shift-ArrowDown`을 두 커맨드에 묶되, 옮길 수 없을 때도 `true`를 돌려 키를 삼킨다(OS 기본 선택 확장이 에디터 안에서 실행되지 않게). TipTap 확장 `MoveBlock`은 이 표를 keymap 플러그인으로 싣는다.

#### Scenario: 단축키로 가운데 블록을 올린다

- **WHEN** 둘째 블록에서 `Mod-Shift-ArrowUp` 핸들러를 부른다
- **THEN** 그 블록이 첫째가 된다

#### Scenario: 양 끝에서 단축키는 키만 삼킨다

- **WHEN** 첫 블록에서 `Mod-Shift-ArrowUp`, 마지막 블록에서 `Mod-Shift-ArrowDown` 핸들러를 부른다
- **THEN** 둘 다 `true`이고 dispatch가 불리지 않는다

실패 의미론: 해당 없음 — 서버 상태 없는 순수 커맨드. 옮길 수 없으면 커맨드는 `false`.
