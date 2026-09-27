/**
 * 최상위 블록 번호로 선택 옮기기(#151 — 검색 노출 점검이 가리키는 블록으로 간다). 근거 문서:
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - Node.isAtom(내용을 따로 편집하지 않는 블록 — 잎 노드 포함): https://prosemirror.net/docs/ref/#model.Node.isAtom
 * - NodeSelection.create: https://prosemirror.net/docs/ref/#state.NodeSelection^create
 * - Selection.findFrom(첫 유효한 커서 자리, 없으면 null): https://prosemirror.net/docs/ref/#state.Selection^findFrom
 * - Transaction.setSelection: https://prosemirror.net/docs/ref/#state.Transaction.setSelection
 */
import { NodeSelection, Selection } from "@tiptap/pm/state";
import type { Command, EditorState } from "@tiptap/pm/state";
import { blockStart } from "./move-block";

/** 최상위 `index`번째(0부터) 블록을 가리키는 선택 — 범위 밖이거나 고를 자리가 없으면 null */
function blockSelection(state: EditorState, index: number): Selection | null {
  const { doc } = state;
  if (!Number.isInteger(index) || index < 0 || index >= doc.childCount) return null;
  const start = blockStart(doc, index);
  const node = doc.child(index);
  // 그림 · 구분선처럼 글이 없는 블록은 그 블록 자체를 고른다 — 커서 자리를 찾으면 다음 블록으로 넘어간다
  if (node.isAtom)
    return NodeSelection.isSelectable(node) ? NodeSelection.create(doc, start) : null;
  // 블록 안(start + 1)에서 앞으로 가장 가까운 커서 자리 — 목록 · 인용처럼 감싼 블록이면 그 안 첫 글줄이다.
  // 블록 끝을 넘는 자리는 다음 블록이라 버린다
  const inside = Selection.findFrom(doc.resolve(start + 1), 1);
  if (inside !== null && inside.from < start + node.nodeSize) return inside;
  return NodeSelection.isSelectable(node) ? NodeSelection.create(doc, start) : null;
}

/** 최상위 `index`번째(0부터) 블록으로 선택을 옮긴다. 스크롤 · 포커스는 부르는 쪽(뷰)이 한다 */
export function selectBlock(index: number): Command {
  return (state, dispatch) => {
    const selection = blockSelection(state, index);
    if (selection === null) return false;
    dispatch?.(state.tr.setSelection(selection));
    return true;
  };
}
