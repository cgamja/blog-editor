# Design — block-guard

## 1. 판정 원천: `docFromNode` 재사용

닫힌 집합의 규칙(안쪽 노드 꾸미기 자리 · 스티커 합계 `MAX_STICKERS_PER_DOC` · enum · 정수 범위 · 원본 크기 짝 · href 허용 목록)은 content-schema zod에 한 번만 있다. 플러그인이 규칙을 다시 적으면 둘이 갈라진다. 그래서 결과 문서를 `docFromNode(tr.doc)`(null attrs 제거 → normalize → `docSchema.parse`)에 넣어 던지면 위반으로 본다. 상수 import조차 필요 없다 — 규칙 자체를 재사용한다.

## 2. 비용

- 문서를 바꾸지 않는 트랜잭션(`tr.docChanged === false` — 선택 이동 등)은 검사하지 않는다
- 판정은 문서 전체다. 스티커 상한은 문서 전역 규칙이라 "바뀐 범위만" 검사하면 놓친다
- 실측(로컬 개발기 · Node 26, `decorationMax` 블록을 반복한 문서에 `docFromNode` 1회): 블록 7개 0.10ms · 70개 0.45ms · 350개 1.7ms. 블로그 글은 수십 블록이라 키 입력마다 돌아도 한 프레임(16ms)에 한참 못 미친다
- 결과는 문서 노드(불변)를 키로 `WeakMap`에 기억한다 — 이전 문서의 판정(아래 3)을 다시 계산하지 않는다

## 3. 이미 닫힌 집합 밖인 문서에서는 막지 않는다

거부 조건은 "이전 문서는 유효 · 결과 문서는 위반"이다. 즉 **이전 문서가 무효면 가드가 꺼진다.** 이 설계는 editor-react가 에디터의 초기 문서를 반드시 `docToNode`(zod 검증)로 만든다는 전제 위에 선다 — 그래서 무효 문서는 정상 경로로 들어오지 않는다. 이전 문서부터 위반이면(정상 경로인 `docToNode`를 거치지 않고 만든 상태) 모든 편집을 막으면 에디터가 얼어 고칠 수도 없게 된다. 그런 문서는 저장 경계(`docFromNode`)가 여전히 거부한다.

## 4. 한글 조합(IME)

CLAUDE.md: `view.composing` 중에는 문서를 바꾸는 부수 효과를 미룬다. 이 플러그인은 문서를 바꾸지 않고 거부만 한다(`appendTransaction` 없음). 조합 입력은 텍스트 삽입뿐이라 유효한 문서를 위반으로 만들 수 없다(zod의 텍스트 규칙은 "비어 있지 않음"뿐 — ProseMirror도 빈 텍스트 노드를 만들지 않는다). 조합 트랜잭션(`tr.getMeta("composition")`, prosemirror-view 1.42.5가 붙인다)에 면제 분기는 없다 — 같은 판정을 지나고, 텍스트 입력이라 위반을 만들 수 없어서 통과한다. 블록 경계를 넘는 선택을 조합으로 바꾸는 경우도 결과 상태가 닫힌 집합 안인지를 테스트로 고정한다. 실브라우저 확인은 IME 체크리스트(#44).

## 5. 우회 meta 키 없음

문서 로드는 트랜잭션이 아니라 `docToNode` → `EditorState.create`로 한다 — zod를 이미 지났다. TipTap `setContent` 같은 트랜잭션 로드도 이 플러그인을 지나는데, 그것이 맞다(유효하지 않은 내용은 들어오지 않아야 한다). 원격 병합은 1단계에 없다. 우회 키를 두면 규칙에 뒷문이 생기므로 만들지 않는다.

## 근거

- `PluginSpec.filterTransaction` — https://prosemirror.net/docs/ref/#state.PluginSpec.filterTransaction (거짓이면 트랜잭션이 적용되지 않는다. 다른 플러그인의 `appendTransaction` 결과도 거친다 — prosemirror-state 1.4.4 `applyTransaction` 소스로 확인)
- `Transaction.docChanged` — https://prosemirror.net/docs/ref/#state.Transaction.docChanged
- 조합 meta — prosemirror-view 1.42.5 `readDOMChange`의 `tr.setMeta("composition", compositionID)`(공식 문서에 없음, 소스로 확인)
