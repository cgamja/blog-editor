import { splitBlockAs } from "@tiptap/pm/commands";
import type { Attrs, Node, NodeType, ResolvedPos } from "@tiptap/pm/model";
import type { Command, Selection, Transaction } from "@tiptap/pm/state";

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

/**
 * 붙여넣기처럼 선택을 바꾸는 교체가 스티커 있는 최상위 블록을 나눴으면 스티커를 한 조각에만 남긴다 — Enter와 같은
 * 규칙이다(글이 있는 첫 조각: 가운데 · 끝이면 앞, 맨 앞이면 뒤). 교체가 블록을 나누면 두 조각 모두 원래 블록의
 * stickers 배열을 **같은 참조로** 가진다(prosemirror 소스 — 업그레이드 때 여기를 다시 본다):
 * - 앞 조각: prosemirror-model 1.25.12 `Node.copy`(src/node.ts) — 같은 attrs 객체를 그대로 쓴다
 * - 뒤 조각: prosemirror-transform 1.12.1 `Fitter.close` → `openFrontierNode(node.type, node.attrs)`(src/replace.ts)
 *   → `NodeType.create` → `computeAttrs`(prosemirror-model src/schema.ts) — attrs 객체는 새로 만들지만 값은 참조로 옮긴다
 * 그래서 교체 범위의 최상위 노드 중 원래 블록과 같은 stickers 배열을 가진 것이 그 블록의 조각이고, 붙인 블록
 * (제 스티커를 되살린 것 포함)은 다른 배열이라 건드리지 않는다. 같은 트랜잭션에서 고쳐야 blockGuard
 * (filterTransaction)가 복제된 결과를 보고 붙여넣기 전체를 거부하지 않는다.
 * 근거: https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute ·
 * https://prosemirror.net/docs/ref/#model.Node.nodesBetween
 */
export function keepStickersOnOnePiece(tr: Transaction, before: Selection): Transaction {
  const { $from, $to } = before;
  if ($from.depth === 0 || $from.index(0) !== $to.index(0)) return tr;
  const original = $from.node(1);
  if (!hasStickers(original)) return tr;
  const pieces: { pos: number; node: Node }[] = [];
  tr.doc.nodesBetween(
    tr.mapping.map($from.before(1), -1),
    tr.mapping.map($from.after(1), 1),
    (node, pos) => {
      if (node.attrs.stickers === original.attrs.stickers) pieces.push({ pos, node });
      // 최상위 블록만 본다 — 스티커는 최상위 블록의 속성이다(adr-008)
      return false;
    },
  );
  if (pieces.length < 2) return tr;
  const keeper = pieces.find(({ node }) => node.content.size > 0) ?? pieces[0];
  for (const piece of pieces) {
    if (piece !== keeper) tr.setNodeAttribute(piece.pos, "stickers", null);
  }
  return tr;
}
