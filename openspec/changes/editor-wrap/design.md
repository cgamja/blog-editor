# Design — editor-wrap

## 1. 감싸기는 ProseMirror 것을 그대로 쓰고, 꾸미기만 같은 트랜잭션에서 옮긴다

- 인용 · 콜아웃은 `findWrapping` + `Transform.wrap`으로 감싼다(prosemirror-commands `wrapIn`과 같은 방식이다. https://prosemirror.net/docs/ref/#commands.wrapIn · https://prosemirror.net/docs/ref/#transform.findWrapping). 목록은 `wrapRangeInList`로 감싼다(https://prosemirror.net/docs/ref/#schema-list.wrapRangeInList). 목록 첫 항목에서 한 단계 들여쓰는 경우까지 원래 동작 그대로다.
- 이 두 함수는 `tr`이 null이면 "할 수 있나"만 답한다. 그래서 can과 실행이 같은 판정을 탄다.
- 커맨드를 따로 부른 뒤 dispatch를 가로채지 않는다. 같은 `tr`에 감싸기와 `setNodeMarkup`을 이어 붙여 한 트랜잭션으로 만든다. undo 한 번에 되돌아간다.

## 2. 꾸미기는 바깥 블록으로 옮긴다

- 범위가 최상위(`range.depth === 0`)일 때만 옮긴다. 이때 감싼 블록들은 안쪽 노드가 되고, 새 바깥 블록이 최상위가 된다. 범위가 이미 안쪽이면(콜아웃 안 문단을 목록으로 감싸는 경우 등) 감싼 블록에도 새 블록에도 꾸미기 자리가 없어서 옮길 것이 없다.
- `stickers`는 감싼 블록들의 스티커를 순서대로 **모두 합쳐** 바깥 블록에 둔다. 스티커는 사용자가 붙인 내용이라 지우면 데이터 손실이다. 문서 전체 스티커 수는 바뀌지 않으므로 상한(blockGuard)에 걸리지 않는다. 좌표는 블록 상대값(adr-008)이라 더 큰 바깥 블록 기준으로 조금 달라진다. 받아들인다.
- `font` · `motion`은 감싼 블록 중 **처음으로 값이 있는 것**을 쓴다. 바깥 블록 하나에는 값이 하나만 들어간다. 감싼 블록 가운데 하나만 꾸며졌어도 그 모양이 남도록 "첫 블록"이 아니라 "값이 있는 첫 블록"으로 정했다. 나머지 블록의 다른 값은 버린다(모양 정보라 되돌릴 수 있다).
- 바깥 노드 타입에 해당 꾸미기 attr가 없는데 옮길 값이 있으면 커맨드는 `false`다. 감싸지 않는다. 지금 감싸기 대상(인용 · 두 목록 · 콜아웃)은 모두 `font` · `motion` · `stickers`를 가지므로 이 분기는 방어용이다.

## 3. 결과는 blockGuard를 통과한다

- 옮긴 뒤 바깥 블록의 자손에 꾸미기가 남아 있지 않다. 그래서 결과 문서는 `docFromNode`를 통과하고, blockGuard를 단 상태에서도 적용된다. 테스트는 blockGuard 플러그인을 단 `EditorState`에 결과 트랜잭션을 apply해 문서가 바뀌는지 본다.
