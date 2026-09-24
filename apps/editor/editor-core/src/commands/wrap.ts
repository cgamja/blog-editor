import type { Attrs, NodeRange, NodeType } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { Command, Transaction } from "@tiptap/pm/state";
import { findWrapping } from "@tiptap/pm/transform";
import { wrapRangeInList } from "@tiptap/pm/schema-list";
import { toneOrNull } from "../closed-values";

/**
 * 감싸기 커맨드 — spec: editor-wrap, design.md.
 * 최상위 블록을 감싸면 그 블록들은 꾸미기 자리가 없는 안쪽 노드가 된다(adr-008). 그래서 꾸미기를 새 바깥 블록으로 옮긴다.
 * 감싸기와 옮기기는 한 트랜잭션이다. 적용할 수 없으면 dispatch 없이 false를 돌려준다(https://prosemirror.net/docs/ref/#state.Command).
 */

/** 감싸는 노드(인용 · 목록 · 콜아웃)가 가질 수 있는 꾸미기 — width는 이미지 · 스크린샷만 가져서 여기 없다(design.md 2) */
const DECORATION_KEYS = ["font", "motion", "stickers"] as const;
type DecorationKey = (typeof DECORATION_KEYS)[number];
type BlockDecoration = Partial<Record<DecorationKey, unknown>>;

/** 값이 하나만 들어가는 꾸미기 — 감싼 블록 중 값이 있는 첫 블록의 것을 쓴다(design.md 2) */
const SINGLE_VALUE_KEYS = ["font", "motion"] as const satisfies readonly DecorationKey[];

const isDecorationKey = (key: string): key is DecorationKey =>
  (DECORATION_KEYS as readonly string[]).includes(key);

/** `tr`이 null이면 할 수 있는지만 답한다 — can과 실행이 같은 판정을 타게 하는 모양 */
type WrapRange = (
  tr: Transaction | null,
  range: NodeRange,
  type: NodeType,
  attrs: Attrs | null,
) => boolean;

// prosemirror-commands wrapIn과 같은 방식이다 — https://prosemirror.net/docs/ref/#transform.findWrapping
const wrapInNode: WrapRange = (tr, range, type, attrs) => {
  const wrapping = findWrapping(range, type, attrs);
  if (wrapping === null) return false;
  tr?.wrap(range, wrapping);
  return true;
};

/** 스티커는 사용자가 붙인 내용이라 모두 모은다. 문서 전체 개수는 그대로라 상한에 걸리지 않는다(design.md 2) */
function decorationOf(range: NodeRange): BlockDecoration {
  const decoration: BlockDecoration = {};
  const stickers: unknown[] = [];
  for (let index = range.startIndex; index < range.endIndex; index += 1) {
    const { attrs } = range.parent.child(index);
    for (const key of SINGLE_VALUE_KEYS) {
      if (decoration[key] === undefined && attrs[key] != null) decoration[key] = attrs[key];
    }
    if (Array.isArray(attrs.stickers)) stickers.push(...attrs.stickers);
  }
  if (stickers.length > 0) decoration.stickers = stickers;
  return decoration;
}

const canHold = (type: NodeType, decoration: BlockDecoration) =>
  Object.keys(decoration).every((key) => Object.hasOwn(type.spec.attrs ?? {}, key));

/**
 * 감싼 블록들의 꾸미기를 바깥 블록으로 옮긴다.
 * 감싸기(https://prosemirror.net/docs/ref/#transform.Transform.wrap)는 range.start 자리에 바깥 블록을 세운다.
 */
function moveDecorationOutward(tr: Transaction, range: NodeRange, decoration: BlockDecoration) {
  // https://prosemirror.net/docs/ref/#model.Node.nodeAt
  const outer = tr.doc.nodeAt(range.start);
  if (outer === null) return;
  // https://prosemirror.net/docs/ref/#model.Node.descendants — offset은 바깥 블록 내용 시작(range.start + 1) 기준
  outer.descendants((node, offset) => {
    const cleared = Object.fromEntries(
      Object.keys(node.attrs)
        .filter(isDecorationKey)
        .filter((key) => node.attrs[key] !== null)
        .map((key) => [key, null]),
    );
    if (Object.keys(cleared).length > 0) {
      // https://prosemirror.net/docs/ref/#transform.Transform.setNodeMarkup
      tr.setNodeMarkup(range.start + 1 + offset, undefined, { ...node.attrs, ...cleared });
    }
  });
  if (Object.keys(decoration).length > 0) {
    tr.setNodeMarkup(range.start, undefined, { ...outer.attrs, ...decoration });
  }
}

function wrapWith(typeName: string, attrs: Attrs | null, wrapRange: WrapRange): Command {
  return (state, dispatch) => {
    const type = state.schema.nodes[typeName];
    const { $from, $to } = state.selection;
    // https://prosemirror.net/docs/ref/#model.ResolvedPos.blockRange
    const range = $from.blockRange($to);
    if (type === undefined || range === null) return false;
    // 최상위를 감쌀 때만 새 바깥 블록이 최상위가 되어 꾸미기를 받을 수 있다
    const isTopLevel = range.depth === 0;
    const decoration = isTopLevel ? decorationOf(range) : {};
    if (!canHold(type, decoration) || !wrapRange(null, range, type, attrs)) return false;
    if (dispatch) {
      const tr = state.tr;
      wrapRange(tr, range, type, attrs);
      if (isTopLevel) moveDecorationOutward(tr, range, decoration);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** 목록 · 항목을 여는 자리 둘 — 감싼 뒤 k번째 문단 안 위치는 원래 위치 + ITEM_DEPTH + ITEM_DEPTH·k */
const ITEM_DEPTH = 2;

/**
 * 문단 여럿을 문단마다 항목 하나로 감싼다. 이 스키마의 목록 항목은 `paragraph (bulletList | orderedList)*`라서
 * 문단 둘을 한 항목에 넣으려는 findWrapping이 실패하기 때문이다(content-schema 목록 모양과 같다).
 * replaceWith는 선택을 매핑하지 못해(교체 구간 밖으로 밀려난다) 원래 글자 위로 다시 둔다.
 */
const wrapParagraphsAsItems: WrapRange = (tr, range, type, attrs) => {
  const { nodes } = range.parent.type.schema;
  const itemType = nodes.listItem;
  const blocks = Array.from({ length: range.endIndex - range.startIndex }, (_, offset) =>
    range.parent.child(range.startIndex + offset),
  );
  if (
    itemType === undefined ||
    !blocks.every((block) => block.type === nodes.paragraph) ||
    // https://prosemirror.net/docs/ref/#model.Node.canReplaceWith
    !range.parent.canReplaceWith(range.startIndex, range.endIndex, type)
  ) {
    return false;
  }
  if (tr === null) return true;
  const { from, to } = tr.selection;
  const shifted = (pos: number) => pos + ITEM_DEPTH + ITEM_DEPTH * paragraphIndexAt(range, pos);
  const list = type.create(
    attrs,
    blocks.map((block) => itemType.create(null, block)),
  );
  // https://prosemirror.net/docs/ref/#transform.Transform.replaceWith
  tr.replaceWith(range.start, range.end, list);
  tr.setSelection(TextSelection.create(tr.doc, shifted(from), shifted(to)));
  return true;
};

/** pos가 든 문단이 범위의 몇 번째인지(0부터) */
function paragraphIndexAt(range: NodeRange, pos: number): number {
  let start = range.start;
  for (let index = range.startIndex; index < range.endIndex; index += 1) {
    const end = start + range.parent.child(index).nodeSize;
    if (pos < end) return index - range.startIndex;
    start = end;
  }
  return range.endIndex - range.startIndex - 1;
}

// https://prosemirror.net/docs/ref/#schema-list.wrapRangeInList — 목록 첫 항목에서 한 단계 들여쓰는 경우까지 원래 동작 그대로.
// 그 방법이 안 되는 여러 문단은 문단마다 항목으로 감싼다
const wrapInListRange: WrapRange = (tr, range, type, attrs) =>
  wrapRangeInList(null, range, type, attrs)
    ? wrapRangeInList(tr, range, type, attrs)
    : wrapParagraphsAsItems(tr, range, type, attrs);

export const wrapInBlockquote: Command = wrapWith("blockquote", null, wrapInNode);
export const wrapInBulletList: Command = wrapWith("bulletList", null, wrapInListRange);
export const wrapInOrderedList: Command = wrapWith("orderedList", null, wrapInListRange);

export function wrapInCallout(tone: string): Command {
  const validTone = toneOrNull(tone);
  if (validTone === null) return () => false;
  return wrapWith("callout", { tone: validTone }, wrapInNode);
}
