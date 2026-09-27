/**
 * 할 일 목록 커맨드 — spec: editor-task-list, adr-028 3절 · adr-036. 체크 여부는 목록 항목 attrs `checked`다
 * (값 없음 = 보통 항목). 근거 문서:
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - Transform.setNodeMarkup: https://prosemirror.net/docs/ref/#transform.Transform.setNodeMarkup
 * - ResolvedPos.node · index: https://prosemirror.net/docs/ref/#model.ResolvedPos
 */
import type { Node, ResolvedPos } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import type { Command, Transaction } from "@tiptap/pm/state";
import { appendCommandStepsAndSelection } from "./derived-command";
import { isList, isTaskItem } from "./list-query";
import { isInTopBlock } from "./turn-into";
import { wrapInBulletList } from "./wrap";

/** `pos`의 노드가 할 일 항목이면 체크를 뒤집는다. 보통 항목 · 다른 노드면 false */
export function toggleTaskItem(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node === null || !isTaskItem(node)) return false;
    dispatch?.(
      state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: !node.attrs.checked }),
    );
    return true;
  };
}

/**
 * 커서가 든 목록 항목(첫 문단 안)을 할 일 항목으로 만든다. 이미 할 일이거나 목록 항목 첫 문단이 아니면 false.
 * 입력 규칙(`[ ] ` · `[x] `)이 표시 글자를 지운 뒤 부른다.
 */
function markItemAtCursor(checked: boolean): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const itemDepth = $from.depth - 1;
    if (itemDepth < 1 || $from.index(itemDepth) !== 0) return false;
    const item = $from.node(itemDepth);
    if (item.type.name !== "listItem" || isTaskItem(item)) return false;
    dispatch?.(
      state.tr.setNodeMarkup($from.before(itemDepth), undefined, { ...item.attrs, checked }),
    );
    return true;
  };
}

/** 한 트랜잭션 안에서 `first` 뒤에 `then`을 잇는다 — `then`이 거절하면 전체가 거절이다 */
function andThen(first: Command, then: Command): Command {
  return (state, dispatch) => {
    const trs: Transaction[] = [];
    if (!first(state, (tr) => trs.push(tr))) return false;
    const [tr] = trs;
    if (tr === undefined) return false;
    const derived = EditorState.create({
      doc: tr.doc,
      selection: tr.selection,
      plugins: state.plugins,
    });
    if (appendCommandStepsAndSelection(tr, derived, then) !== "applied") return false;
    dispatch?.(tr);
    return true;
  };
}

/**
 * `[ ] ` · `[x] ` 입력 규칙이 부르는 커맨드 — 목록 항목이면 그 항목에, 최상위 문단이면 점 목록으로 감싼 뒤 싣는다
 * (감싸기는 꾸미기를 목록으로 옮긴다 — wrap.ts).
 */
export function turnIntoTaskItem(checked: boolean): Command {
  const mark = markItemAtCursor(checked);
  const wrapAndMark = andThen(wrapInBulletList, mark);
  return (state, dispatch) =>
    isInTopBlock(state, state.selection.from, ["paragraph"])
      ? wrapAndMark(state, dispatch)
      : mark(state, dispatch);
}

/** 목록 노드 바로 아래의 보통 항목 자리 — 이미 할 일인 항목은 뺀다 */
function plainItemsOf(list: Node, listPos: number): { pos: number; item: Node }[] {
  const items: { pos: number; item: Node }[] = [];
  list.forEach((item, offset) => {
    if (item.type.name === "listItem" && !isTaskItem(item))
      items.push({ pos: listPos + 1 + offset, item });
  });
  return items;
}

/** 목록의 보통 항목을 모두 체크하지 않은 할 일로. 바꾼 항목 수를 돌려준다 */
function markAllItems(tr: Transaction, listPos: number): number {
  const list = tr.doc.nodeAt(listPos);
  if (list === null) return 0;
  const items = plainItemsOf(list, listPos);
  // 속성만 바꾸니 자리는 그대로다 — https://prosemirror.net/docs/ref/#transform.Transform.setNodeMarkup
  for (const { pos, item } of items)
    tr.setNodeMarkup(pos, undefined, { ...item.attrs, checked: false });
  return items.length;
}

/** `$pos`를 감싼 가장 가까운 목록 항목의 부모 목록 자리 — 목록 항목 안이 아니면 null */
function enclosingListPos($pos: ResolvedPos): number | null {
  for (let depth = $pos.depth; depth > 1; depth -= 1) {
    if ($pos.node(depth).type.name === "listItem") return $pos.before(depth - 1);
  }
  return null;
}

/**
 * 블록 메뉴 「바꾸기 → 할 일 목록」(spec: editor-task-list). 커서가 든 최상위 블록이 목록이면 그 목록의 보통 항목을 할 일로,
 * 아니면 점 목록으로 감싼 뒤 감싼 목록의 항목을 할 일로 만든다. 감싼 목록은 최상위가 아닐 수 있어(콜아웃 안 문단)
 * 감싼 뒤 선택에서 가장 가까운 목록 항목의 부모 목록으로 찾는다 — 감싸기는 선택을 새 항목 안으로 옮긴다(wrap.ts).
 */
export const wrapInTaskList: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.depth === 0) return false;
  const top = $from.node(1);
  const topPos = $from.before(1);
  if (isList(top)) {
    // 이미 모든 항목이 할 일이면 바꿀 것이 없다(turnIntoTextblock처럼 false)
    if (plainItemsOf(top, topPos).length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      markAllItems(tr, topPos);
      dispatch(tr.scrollIntoView());
    }
    return true;
  }
  const trs: Transaction[] = [];
  if (!wrapInBulletList(state, (tr) => trs.push(tr))) return false;
  const [tr] = trs;
  if (tr === undefined) return false;
  if (dispatch) {
    const listPos = enclosingListPos(tr.selection.$from);
    if (listPos !== null) markAllItems(tr, listPos);
    dispatch(tr);
  }
  return true;
};
