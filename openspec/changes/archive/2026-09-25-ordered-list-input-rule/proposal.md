# ordered-list-input-rule (이슈 #115)

## Why

#80으로 번호 목록에 시작 번호(`start`)가 생겼지만 에디터 입력 규칙은 `1. `만 번호 목록으로 바꾼다. 빈 문단에 `3. `을 치면 글자로 남아서, 3부터 시작하는 목록은 붙여넣기나 markdown 가져오기로만 만들 수 있다.

## What Changes

- editor-core 입력 규칙: 최상위 문단 맨 앞 `n. `(n은 `ORDERED_LIST_START_RANGE` 안의 정수)이 번호 목록이 되고 start = n. 1은 정규형대로 저장하지 않는다. 범위 밖(`0. ` · 9자리 초과)은 글자로 남는다
- 바로 앞 최상위 번호 목록에 이어지는 번호(앞 목록 start + 항목 수 = n)면 그 목록에 합친다 — TipTap 기본 OrderedList 입력 규칙의 joinPredicate와 같은 조건. 단 새 목록에 꾸미기(글꼴 · 움직임 · 스티커)가 있으면 합치지 않는다(합치면 앞 목록 attrs만 남아 꾸미기를 잃는다)
- editor-core `closed-values`: 범위 검사만 하는 `orderedListNumberOrNull`(기본 1을 없음으로 바꾸지 않는 쪽)

## Impact

- 조합 중(`view.composing`)에는 기존 입력 규칙과 같이 돌지 않는다(prosemirror-inputrules run)
- 하지 않는 것: 점 목록 `- `이 앞 점 목록에 합쳐지는 동작(지금처럼 합치지 않는다) · 목록 항목 안(안쪽) 입력 규칙 · 시작 번호를 고치는 UI
