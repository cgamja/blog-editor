import type { Attrs, Node, NodeType } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command, EditorState, Selection } from "@tiptap/pm/state";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import { stickerCount, stickersOf } from "./sticker-query";

/**
 * 블록 바꾸기 · 복제 — spec: editor-markdown-shortcuts, design.md 4.
 * 꾸미기 자리는 최상위 블록에만 있어서(adr-008) 대상은 커서가 든 최상위 블록이다.
 */

/** pos가 최상위(깊이 1) 블록 안이고 그 블록 타입이 types 중 하나인가 — 목록 · 인용 · 콜아웃 안은 아니다(design.md 3) */
export function isInTopBlock(state: EditorState, pos: number, types: readonly string[]): boolean {
  const $pos = state.doc.resolve(pos);
  return $pos.depth === 1 && types.includes($pos.parent.type.name);
}

/** 텍스트 블록이 가질 수 있는 꾸미기 — width는 이미지 · 스크린샷만 가진다 */
const TEXTBLOCK_DECORATION_KEYS = ["font", "motion", "stickers"] as const;

/** 커서가 든 최상위 텍스트 블록. 목록 · 인용 · 콜아웃 안이거나 선택이 블록을 넘으면 null(design.md 3) */
function topTextblock(state: EditorState): { pos: number; node: Node } | null {
  const { $from, $to } = state.selection;
  // https://prosemirror.net/docs/ref/#model.ResolvedPos.sameParent
  if ($from.depth !== 1 || !$from.parent.isTextblock || !$from.sameParent($to)) return null;
  return { pos: $from.before(1), node: $from.parent };
}

/** 새 타입이 자리를 가진 꾸미기만 옛 노드에서 들고 간다 — 폰트는 코드 블록으로 가면 떨어진다(design.md 4) */
function carriedAttrs(old: Node, type: NodeType, attrs: Attrs | null): Attrs {
  const spec = type.spec.attrs ?? {};
  const carried = TEXTBLOCK_DECORATION_KEYS.filter(
    (key) => Object.hasOwn(spec, key) && old.attrs[key] != null,
  ).map((key) => [key, old.attrs[key]]);
  return { ...Object.fromEntries(carried), ...attrs };
}

const hasAttrs = (node: Node, attrs: Attrs | null) =>
  Object.entries(attrs ?? {}).every(([key, value]) => node.attrs[key] === value);

/**
 * 커서가 든 최상위 텍스트 블록을 typeName으로 바꾼다. 이미 그 모양이면 false.
 * 받을 수 없는 마크는 setBlockType이 지운다 — https://prosemirror.net/docs/ref/#transform.Transform.setBlockType
 */
export function turnIntoTextblock(typeName: string, attrs: Attrs | null = null): Command {
  return (state, dispatch) => {
    const type = state.schema.nodes[typeName];
    const target = topTextblock(state);
    if (type === undefined || target === null) return false;
    if (target.node.type === type && hasAttrs(target.node, attrs)) return false;
    const index = state.doc.resolve(target.pos).index();
    // https://prosemirror.net/docs/ref/#model.Node.canReplaceWith
    if (!state.doc.canReplaceWith(index, index + 1, type)) return false;
    if (dispatch) {
      const from = target.pos + 1;
      const tr = state.tr.setBlockType(from, from + target.node.content.size, type, (old) =>
        carriedAttrs(old, type, attrs),
      );
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** 커서(또는 노드 선택)가 든 최상위 블록과 그 시작 위치. GapCursor · AllSelection은 null */
function topBlockOf(selection: Selection): { pos: number; node: Node } | null {
  if (selection instanceof NodeSelection && selection.$from.depth === 0) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  if ($from.depth === 0) return null;
  return { pos: $from.before(1), node: $from.node(1) };
}

/** 복제본 안 같은 자리. 선택이 복제한 블록 밖까지 걸치면 앞쪽 끝에 커서만 둔다 */
function selectionInCopy(state: EditorState, doc: Node, shift: number, end: number): Selection {
  const { selection } = state;
  if (selection instanceof NodeSelection) return NodeSelection.create(doc, selection.from + shift);
  if (selection.to <= end) {
    return TextSelection.create(doc, selection.anchor + shift, selection.head + shift);
  }
  return TextSelection.create(doc, selection.from + shift);
}

/**
 * 커서가 든 최상위 블록을 바로 뒤에 복제하고 커서를 복제본으로 옮긴다(Notion ⌘D).
 * 문서 스티커 수가 상한(adr-008)을 넘으면 false — blockGuard가 거부하기 전에 먼저 답한다.
 */
export const duplicateTopBlock: Command = (state, dispatch) => {
  const block = topBlockOf(state.selection);
  if (block === null) return false;
  if (stickerCount(state.doc) + stickersOf(block.node).length > MAX_STICKERS_PER_DOC) return false;
  if (dispatch) {
    const end = block.pos + block.node.nodeSize;
    // https://prosemirror.net/docs/ref/#transform.Transform.insert
    const tr = state.tr.insert(end, block.node);
    tr.setSelection(selectionInCopy(state, tr.doc, block.node.nodeSize, end));
    dispatch(tr.scrollIntoView());
  }
  return true;
};
