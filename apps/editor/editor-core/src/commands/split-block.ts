import { splitBlockAs } from "@tiptap/pm/commands";
import type { Attrs, Node, NodeType, ResolvedPos } from "@tiptap/pm/model";
import type { Command, Transaction } from "@tiptap/pm/state";

/**
 * 스티커가 있는 블록을 나눈다 — 스티커는 한 블록에만 남는다(spec: editor-schema, design.md 6).
 * 가운데 · 끝이면 원래(앞) 블록에, 맨 앞이면 글이 남은 뒤 블록에. 글꼴 · 움직임 · 폭은 양쪽에 남는다.
 * 코드 블록 · 스티커 없는 블록 · 나눌 수 없는 자리에서는 false — 코어 Enter(newlineInCode 등)에 넘긴다.
 * 나누기와 스티커 처리가 한 트랜잭션이라 undo 한 번에 되돌아간다.
 * 근거: https://prosemirror.net/docs/ref/#commands.splitBlockAs ·
 * https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute
 */

const hasStickers = (node: Node) =>
  Array.isArray(node.attrs.stickers) && node.attrs.stickers.length > 0;

/** 이어 쓰는 블록에 옮길 attrs — 스티커는 빼고, 그 타입이 가진 attrs만. */
function carriedAttrs(from: Node, to: NodeType): Attrs {
  return Object.fromEntries(
    Object.keys(to.spec.attrs ?? {})
      .filter((key) => key !== "stickers" && key in from.attrs)
      .map((key) => [key, from.attrs[key]]),
  );
}

function splitTarget(node: Node, atEnd: boolean, $from: ResolvedPos) {
  if (atEnd) {
    // 끝에서 나누면 뒤는 그 자리의 기본 블록(보통 문단)이다
    const type = $from.node(-1).contentMatchAt($from.indexAfter(-1)).defaultType;
    return type ? { type, attrs: carriedAttrs(node, type) } : null;
  }
  // 맨 앞이면 뒤 블록이 글을 가지므로 스티커까지, 가운데면 스티커만 뺀다
  const atStart = $from.parentOffset === 0;
  return {
    type: node.type,
    attrs: atStart ? node.attrs : { ...node.attrs, stickers: null },
  };
}

/** 맨 앞에서 나눈 뒤 새로 생긴 빈 앞 블록의 스티커를 지운다. 나눈 뒤 커서는 뒤 블록 맨 앞이다. */
function clearEmptyFrontStickers(tr: Transaction): Transaction {
  const backStart = tr.selection.$from.before();
  const front = tr.doc.resolve(backStart).nodeBefore;
  if (front === null || front.content.size > 0 || front.attrs.stickers == null) return tr;
  return tr.setNodeAttribute(backStart - front.nodeSize, "stickers", null);
}

export const splitBlockKeepingStickers: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const block = $from.parent;
  if (!block.isTextblock || block.type.spec.code || !hasStickers(block)) return false;
  const atStart = $from.parentOffset === 0 && $from.parentOffset !== block.content.size;
  return splitBlockAs(splitTarget)(
    state,
    dispatch && ((tr) => dispatch(atStart ? clearEmptyFrontStickers(tr) : tr)),
  );
};
