import { Extension } from "@tiptap/core";
import type { Node, NodeType } from "@tiptap/pm/model";
import { keymap } from "@tiptap/pm/keymap";
import { liftListItem, sinkListItem, splitListItem } from "@tiptap/pm/schema-list";
import type { Command, EditorState, Plugin, Transaction } from "@tiptap/pm/state";
import { stickerCount, stickersOf } from "../commands/sticker-query";
import { carriedAttrs } from "../commands/turn-into";

/**
 * 목록 키 — spec: editor-list-keys, list-keys design.md.
 * 우리 listItem은 `paragraph (bulletList | orderedList)*`라 prosemirror-schema-list 커맨드가 전제하는 모양과 같다.
 * https://prosemirror.net/docs/ref/#schema-list
 */

const listItemOf = (state: EditorState): NodeType | undefined => state.schema.nodes.listItem;

/** 커서가 목록 항목의 문단 안에 있나 — 항목의 첫 자식만 문단이다 */
function isInListItem(state: EditorState): boolean {
  const { $from } = state.selection;
  return $from.depth >= 2 && $from.node(-1).type.name === "listItem";
}

const decorationKey = (node: Node) =>
  JSON.stringify([node.attrs.font ?? null, node.attrs.motion ?? null, stickersOf(node)]);

/** 꾸미기가 하나도 없는 블록의 decorationKey */
const BARE = JSON.stringify([null, null, []]);

/**
 * 최상위 목록에서 항목을 빼낸 뒤 꾸미기를 한 블록에만 남긴다(design.md 5).
 * liftListItem은 목록을 둘로 가를 때 두 조각에 같은 attrs를 주고, 목록이 통째로 빠지면 목록 노드와 함께 꾸미기가 사라진다.
 * https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute
 */
function keepDecorationOnce(state: EditorState, tr: Transaction): Transaction {
  const { $from } = state.selection;
  const top = $from.node(1);
  const topPos = $from.before(1);
  const stickers = stickersOf(top);
  const isDecoratedList = top.type.spec.content === "listItem+" && decorationKey(top) !== BARE;
  if (!isDecoratedList) return tr;

  if (stickerCount(tr.doc) > stickerCount(state.doc)) {
    const sameStickers = JSON.stringify(stickers);
    const repeats: number[] = [];
    let seen = false;
    tr.doc.forEach((node, offset) => {
      if (stickers.length === 0 || JSON.stringify(stickersOf(node)) !== sameStickers) return;
      if (seen) repeats.push(offset);
      seen = true;
    });
    for (const pos of repeats) tr.setNodeAttribute(pos, "stickers", null);
  }

  const key = decorationKey(top);
  let survives = false;
  tr.doc.forEach((node) => {
    if (node.type === top.type && decorationKey(node) === key) survives = true;
  });
  if (survives) return tr;

  const landedPos = tr.mapping.map(topPos);
  const landed = tr.doc.nodeAt(landedPos);
  if (landed === null) return tr;
  // https://prosemirror.net/docs/ref/#transform.Transform.setNodeMarkup
  return tr.setNodeMarkup(landedPos, undefined, {
    ...landed.attrs,
    ...carriedAttrs(top, landed.type, null),
  });
}

/** 한 단계 내어쓰기 — 안쪽이면 바깥 목록으로, 최상위면 목록을 빠져나온다 */
const liftItem: Command = (state, dispatch) => {
  const listItem = listItemOf(state);
  if (listItem === undefined) return false;
  // https://prosemirror.net/docs/ref/#schema-list.liftListItem
  return liftListItem(listItem)(
    state,
    dispatch && ((tr) => dispatch(keepDecorationOnce(state, tr))),
  );
};

/** 빈 항목은 위치와 상관없이 내어쓴다 — 라이브러리 splitListItem은 가운데 빈 항목이면 빈 항목을 하나 더 만든다(design.md 2) */
const enterInList: Command = (state, dispatch) => {
  const listItem = listItemOf(state);
  if (listItem === undefined || !isInListItem(state)) return false;
  const { $from, empty } = state.selection;
  if (empty && $from.parent.content.size === 0) return liftItem(state, dispatch);
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
  return isInListItem(state) && empty && $from.parentOffset === 0 && liftItem(state, dispatch);
};

export const listKeymap: Record<string, Command> = {
  Enter: enterInList,
  Tab: swallowInList(sinkItem),
  "Shift-Tab": swallowInList(liftItem),
  Backspace: backspaceAtItemStart,
};

// 입력 규칙 되돌리기(1100)보다 뒤, 커스텀 블록 Backspace · StickerSafeSplit(1000)과 코어 Keymap(100)보다 앞(design.md 6)
const LIST_KEYS_PRIORITY = 1050;

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
