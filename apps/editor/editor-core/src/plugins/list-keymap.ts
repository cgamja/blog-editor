import { Extension } from "@tiptap/core";
import type { Node, NodeType } from "@tiptap/pm/model";
import { keymap } from "@tiptap/pm/keymap";
import { liftListItem, sinkListItem, splitListItem } from "@tiptap/pm/schema-list";
import { TextSelection } from "@tiptap/pm/state";
import type { Command, EditorState, Plugin, Transaction } from "@tiptap/pm/state";
import { sameStickers, stickersOf } from "../commands/sticker-query";
import { carriedAttrs } from "../commands/turn-into";
import { LIST_KEYS_PRIORITY } from "../keymap-priority.constants";

/**
 * 목록 키 — spec: editor-list-keys, list-keys design.md.
 * 우리 listItem은 `paragraph (bulletList | orderedList)*`라 prosemirror-schema-list 커맨드가 전제하는 모양과 같다.
 * https://prosemirror.net/docs/ref/#schema-list
 */

const LIST_TYPES = ["bulletList", "orderedList"] as const;

const isList = (node: Node | null | undefined): node is Node =>
  node != null && (LIST_TYPES as readonly string[]).includes(node.type.name);

const listItemOf = (state: EditorState): NodeType | undefined => state.schema.nodes.listItem;

/** 커서가 목록 항목의 문단 안에 있나 — 항목의 첫 자식만 문단이다 */
function isInListItem(state: EditorState): boolean {
  const { $from } = state.selection;
  return $from.depth >= 2 && $from.node(-1).type.name === "listItem";
}

const hasDecoration = (node: Node) =>
  node.attrs.font != null || node.attrs.motion != null || stickersOf(node).length > 0;

const sameDecoration = (a: Node, b: Node) =>
  a.attrs.font === b.attrs.font &&
  a.attrs.motion === b.attrs.motion &&
  sameStickers(stickersOf(a), stickersOf(b));

/** 원래 최상위 목록이 차지하던 자리의 최상위 블록들 — 다른 곳의 같은 꾸미기를 건드리지 않게 범위를 좁힌다 */
function topBlocksIn(doc: Node, from: number, to: number): { node: Node; pos: number }[] {
  const blocks: { node: Node; pos: number }[] = [];
  doc.forEach((node, pos) => {
    if (pos >= from && pos < to) blocks.push({ node, pos });
  });
  return blocks;
}

/**
 * 목록이 둘로 갈리면 liftListItem이 두 조각에 같은 attrs를 준다. 글꼴은 보기 연속성 때문에 두 조각 모두 두고,
 * 움직임 · 스티커는 앞 조각에만 남긴다(design.md 5). https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute
 */
function dropDuplicatedDecoration(
  tr: Transaction,
  top: Node,
  blocks: { node: Node; pos: number }[],
): void {
  const pieces = blocks.filter(({ node }) => node.type === top.type && sameDecoration(node, top));
  for (const { pos } of pieces.slice(1)) {
    tr.setNodeAttribute(pos, "motion", null).setNodeAttribute(pos, "stickers", null);
  }
}

/** 목록이 통째로 빠지면 목록 노드와 함께 꾸미기가 사라진다 — 빠져나온 첫 블록에 옮긴다(design.md 5) */
function restoreLostDecoration(
  tr: Transaction,
  top: Node,
  blocks: { node: Node; pos: number }[],
): void {
  const survives = blocks.some(({ node }) => node.type === top.type && sameDecoration(node, top));
  const landed = blocks[0];
  if (survives || landed === undefined) return;
  // https://prosemirror.net/docs/ref/#transform.Transform.setNodeMarkup
  tr.setNodeMarkup(landed.pos, undefined, {
    ...landed.node.attrs,
    ...carriedAttrs(top, landed.node.type, null),
  });
}

/** 최상위 목록에서 항목을 빼낸 뒤 — 움직임 · 스티커는 한 곳에만, 글꼴은 조각마다 남긴다 */
function keepTopListDecoration(state: EditorState, tr: Transaction): Transaction {
  const { $from } = state.selection;
  const top = $from.node(1);
  if (!isList(top) || !hasDecoration(top)) return tr;
  const topPos = $from.before(1);
  const blocks = () =>
    topBlocksIn(tr.doc, tr.mapping.map(topPos, -1), tr.mapping.map(topPos + top.nodeSize, 1));
  dropDuplicatedDecoration(tr, top, blocks());
  restoreLostDecoration(tr, top, blocks());
  return tr;
}

/**
 * 한 단계 내어쓰기 — 안쪽이면 바깥 목록으로, 최상위면 목록을 빠져나온다.
 * 최상위 목록의 꾸미기(글꼴 · 움직임 · 스티커)를 같은 트랜잭션에서 보정한다(keepTopListDecoration).
 * https://prosemirror.net/docs/ref/#schema-list.liftListItem
 */
const liftItemKeepingDecoration: Command = (state, dispatch) => {
  const listItem = listItemOf(state);
  if (listItem === undefined) return false;
  return liftListItem(listItem)(
    state,
    dispatch && ((tr) => dispatch(keepTopListDecoration(state, tr))),
  );
};

/** 빈 항목은 위치와 상관없이 내어쓴다 — 라이브러리 splitListItem은 가운데 빈 항목이면 빈 항목을 하나 더 만든다(design.md 2) */
const enterInList: Command = (state, dispatch) => {
  const listItem = listItemOf(state);
  if (listItem === undefined || !isInListItem(state)) return false;
  const { $from, empty } = state.selection;
  if (empty && $from.parent.content.size === 0) return liftItemKeepingDecoration(state, dispatch);
  // https://prosemirror.net/docs/ref/#schema-list.splitListItem
  return splitListItem(listItem)(state, dispatch);
};

/** 목록 안에서는 못 해도 키를 삼킨다 — 목록을 쓰다 포커스가 에디터 밖으로 튀지 않게. 목록 밖은 브라우저 기본(design.md 3) */
const swallowInList =
  (command: Command): Command =>
  (state, dispatch) =>
    isInListItem(state) && (command(state, dispatch) || true);

const sinkItem: Command = (state, dispatch) => {
  const listItem = listItemOf(state);
  // https://prosemirror.net/docs/ref/#schema-list.sinkListItem
  return listItem !== undefined && sinkListItem(listItem)(state, dispatch);
};

const backspaceAtItemStart: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  return (
    isInListItem(state) &&
    empty &&
    $from.parentOffset === 0 &&
    liftItemKeepingDecoration(state, dispatch)
  );
};

/** 목록 안 마지막 텍스트 블록의 끝 자리 — 안쪽 목록이 있으면 가장 안쪽 마지막 항목 */
function lastTextEnd(list: Node, listPos: number): number {
  let node = list;
  let pos = listPos;
  while (!node.isTextblock) {
    const last = node.lastChild;
    if (last === null) return -1;
    pos += node.nodeSize - last.nodeSize - 1;
    node = last;
  }
  return pos + node.nodeSize - 1;
}

/**
 * 목록 바로 뒤 최상위 문단 맨 앞 Backspace는 앞 목록 마지막 항목 끝에 글자를 합친다(Notion과 같다, design.md 4).
 * 기본 joinBackward는 문단을 목록 항목으로 다시 감싸 내어쓰기와 핑퐁이 된다. 꾸미기가 있는 문단은 꾸미기를 잃지 않게 넘긴다.
 * https://prosemirror.net/docs/ref/#commands.joinBackward
 */
const joinIntoPreviousList: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth !== 1 || $from.parentOffset !== 0) return false;
  const paragraph = $from.parent;
  if (paragraph.type.name !== "paragraph" || hasDecoration(paragraph)) return false;
  const before = $from.index(0) > 0 ? state.doc.child($from.index(0) - 1) : null;
  if (!isList(before)) return false;
  const paragraphPos = $from.before(1);
  const textEnd = lastTextEnd(before, paragraphPos - before.nodeSize);
  if (textEnd < 0) return false;
  if (dispatch) {
    const tr = state.tr
      .delete(paragraphPos, paragraphPos + paragraph.nodeSize)
      .insert(textEnd, paragraph.content);
    dispatch(tr.setSelection(TextSelection.create(tr.doc, textEnd)).scrollIntoView());
  }
  return true;
};

export const listKeymap: Record<string, Command> = {
  Enter: enterInList,
  Tab: swallowInList(sinkItem),
  "Shift-Tab": swallowInList(liftItemKeepingDecoration),
  Backspace: (state, dispatch) =>
    backspaceAtItemStart(state, dispatch) || joinIntoPreviousList(state, dispatch),
};

/**
 * 한글 조합 중 keydown은 prosemirror-view가 handleKeyDown에 넘기기 전에 버린다(1.42.5 editHandlers.keydown →
 * inOrNearComposition) — 조합 중 Enter는 조합 확정만 한다. 등록만 한다(adr-002).
 * https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#prosemirror-plugins
 */
export function listKeyPlugins(): Plugin[] {
  return [keymap(listKeymap)];
}

export const ListKeys = Extension.create({
  name: "listKeys",
  priority: LIST_KEYS_PRIORITY,
  addProseMirrorPlugins: () => listKeyPlugins(),
});
