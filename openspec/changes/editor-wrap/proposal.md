# editor-wrap (이슈 #45)

## Why

#41 리뷰에서 나온 문제다. 꾸미기(`font` · `motion` · `stickers`)가 붙은 최상위 문단을 ProseMirror 기본 `wrapIn(blockquote)`이나 `wrapInList`로 감싸면, 그 문단이 안쪽 노드가 되는데도 꾸미기가 그대로 남는다. 그런 문서는 닫힌 집합을 어긴다(안쪽 노드에는 꾸미기 자리가 없다, adr-008). 그래서 blockGuard가 트랜잭션을 거부하는데, 커맨드 자체는 `true`를 돌려준다. 버튼은 눌리지만 아무 일도 일어나지 않는다. 꾸미기를 그냥 지우면 스티커(사용자가 붙인 내용)가 사라진다.

## What Changes

- editor-core에 감싸기 커맨드 넷을 둔다(ProseMirror `Command`): `wrapInBlockquote` · `wrapInBulletList` · `wrapInOrderedList` · `wrapInCallout(tone)`
- 최상위 블록을 감싸면 그 블록들의 꾸미기를 **바깥 블록(새로 최상위가 되는 노드)으로 옮긴다**. 안쪽이 된 블록의 꾸미기는 지운다. 트랜잭션은 하나다.
- 적용할 수 없으면 dispatch 없이 `false`다. dispatch 없는 호출(can)과 실제 실행의 답이 같다.

## Impact

- 새 파일 `apps/editor/editor-core/src/commands/wrap.ts`(+ 테스트)를 두고, `index.ts`에는 export 한 줄만 더한다
- 새 의존성은 없다(`@tiptap/pm`의 `transform` · `schema-list` · `state`)
- 하지 않는 것: 툴바 · 키맵 등록(editor-react), 감싸기 해제(lift), 실브라우저 확인(#44)
