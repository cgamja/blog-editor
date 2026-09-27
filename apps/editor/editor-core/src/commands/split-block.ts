import { splitBlockAs } from "@tiptap/pm/commands";
import type { Attrs, Node, NodeType, ResolvedPos, Slice } from "@tiptap/pm/model";
import type { Command, Selection, Transaction } from "@tiptap/pm/state";

/**
 * 스티커 · 간격이 있는 블록을 나눈다 — 스티커는 한 블록에만 남는다(spec: editor-schema, design.md 6).
 * 가운데 · 끝이면 원래(앞) 블록에, 맨 앞이면 글이 남은 뒤 블록에. 글꼴 · 움직임 · 폭은 양쪽에 남는다.
 * 간격(블록 위 여백, adr-037)은 어디서 나누든 앞 조각에만 — 간격은 원래 블록 위 자리라 맨 앞에서 나누면 빈 앞 조각이
 * 그 자리를 갖고, 이어 쓴 뒤 블록이 넓게 띄지 않는다.
 * 코드 블록 · 스티커도 간격도 없는 블록 · 나눌 수 없는 자리에서는 false — 코어 Enter(newlineInCode 등)에 넘긴다.
 * 나누기와 스티커 · 간격 처리가 한 트랜잭션이라 undo 한 번에 되돌아간다.
 * 근거: https://prosemirror.net/docs/ref/#commands.splitBlockAs ·
 * https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute
 */

const hasStickers = (node: Node) =>
  Array.isArray(node.attrs.stickers) && node.attrs.stickers.length > 0;

const hasSpace = (node: Node) => node.attrs.space != null;

/** 나눈 뒤 블록에 옮기지 않는 attrs — 원래(앞) 블록에만 남는다 */
const FRONT_ONLY_ATTRS: ReadonlySet<string> = new Set(["stickers", "space"]);

/** 이어 쓰는 블록에 옮길 attrs — 스티커 · 간격은 빼고, 그 타입이 가진 attrs만. */
function carriedAttrs(from: Node, to: NodeType): Attrs {
  return Object.fromEntries(
    Object.keys(to.spec.attrs ?? {})
      .filter((key) => !FRONT_ONLY_ATTRS.has(key) && key in from.attrs)
      .map((key) => [key, from.attrs[key]]),
  );
}

function splitTarget(node: Node, atEnd: boolean, $from: ResolvedPos) {
  if (atEnd) {
    // 끝에서 나누면 뒤는 그 자리의 기본 블록(보통 문단)이다
    const type = $from.node(-1).contentMatchAt($from.indexAfter(-1)).defaultType;
    return type ? { type, attrs: carriedAttrs(node, type) } : null;
  }
  // 간격은 늘 앞 조각에. 스티커는 맨 앞이면 글을 가진 뒤 블록으로 가고, 가운데면 앞에 남는다
  const atStart = $from.parentOffset === 0;
  return {
    type: node.type,
    attrs: { ...node.attrs, space: null, ...(atStart ? {} : { stickers: null }) },
  };
}

/** 맨 앞에서 나눈 뒤 새로 생긴 빈 앞 블록의 스티커를 지운다. 나눈 뒤 커서는 뒤 블록 맨 앞이다. */
function clearEmptyFrontStickers(tr: Transaction): Transaction {
  const backStart = tr.selection.$from.before();
  const front = tr.doc.resolve(backStart).nodeBefore;
  if (front === null || front.content.size > 0 || front.attrs.stickers == null) return tr;
  return tr.setNodeAttribute(backStart - front.nodeSize, "stickers", null);
}

export const splitBlockKeepingDecoration: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const block = $from.parent;
  if (!block.isTextblock || block.type.spec.code) return false;
  if (!hasStickers(block) && !hasSpace(block)) return false;
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

/**
 * 붙여넣은 조각의 끝이 열려 있으면(openEnd > 0) 원래 블록에서 선택 뒤에 남은 글은 조각의 마지막 노드에 이어 붙는다 —
 * prosemirror-model `replace`의 `joinable($end, $to, depth)`는 조각 쪽 노드(`$end.node`)를 남긴다. 그래서 뒤 조각은
 * 붙인 마지막 최상위 노드 자신이고 제 간격을 갖는다. 이어 붙일 수 없는 타입이면(Fitter가 원래 블록 타입 · attrs로
 * 새로 연다) 뒤 조각의 타입이 조각의 마지막 노드와 다르다.
 * 근거: https://prosemirror.net/docs/ref/#model.Slice · https://prosemirror.net/docs/ref/#transform.ReplaceStep
 */
function isPastedLastNode(back: Node, slice: Slice): boolean {
  const last = slice.content.lastChild;
  return slice.openEnd > 0 && last !== null && back.type === last.type;
}

/**
 * 붙여넣기처럼 선택을 바꾸는 교체가 간격 있는 최상위 블록을 나눴으면 간격은 앞 조각에만 남긴다 — Enter와 같은 규칙이다.
 * 간격은 문자열이라 스티커처럼 참조로 조각을 알아볼 수 없다. 대신 원래 블록에서 선택 뒤에 남은 글이 있을 때, 그 글의
 * 새 자리(매핑, assoc 1)가 든 최상위 블록이 앞 조각(원래 블록 시작의 새 자리)과 다르면 그것이 뒤 조각이다. 선택 뒤에
 * 남은 글이 없거나, 끝이 열린 조각이라 뒤 조각이 붙인 마지막 노드이면(isPastedLastNode) 제 간격을 그대로 둔다.
 * 근거: https://prosemirror.net/docs/ref/#transform.Mapping.map ·
 * https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute
 */
export function keepSpaceOnFrontPiece(
  tr: Transaction,
  before: Selection,
  slice: Slice,
): Transaction {
  const { $from, $to } = before;
  if ($from.depth === 0 || $from.index(0) !== $to.index(0)) return tr;
  if (!hasSpace($from.node(1)) || $to.pos >= $from.end(1)) return tr;
  const frontStart = tr.mapping.map($from.before(1), -1);
  const $back = tr.doc.resolve(tr.mapping.map($to.pos, 1));
  if ($back.depth === 0 || $back.before(1) === frontStart) return tr;
  const back = $back.node(1);
  if (!hasSpace(back) || isPastedLastNode(back, slice)) return tr;
  return tr.setNodeAttribute($back.before(1), "space", null);
}
