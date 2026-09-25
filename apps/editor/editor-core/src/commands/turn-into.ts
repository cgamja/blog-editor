import type { Attrs, Mark, Node, NodeType } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command, EditorState, Selection, Transaction } from "@tiptap/pm/state";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import { stickerCount, stickersOf } from "./sticker-query";

/**
 * 블록 바꾸기 · 복제 — spec: editor-markdown-shortcuts, design.md 4.
 * 꾸미기 자리는 최상위 블록에만 있어서(adr-008) 대상은 커서가 든 최상위 블록이다.
 */

/** 목록 · 인용 · 콜아웃 안은 최상위가 아니다(design.md 3) */
export function isInTopBlock(state: EditorState, pos: number, types: readonly string[]): boolean {
  const $pos = state.doc.resolve(pos);
  return $pos.depth === 1 && types.includes($pos.parent.type.name);
}

/** 문단 하나를 닫고 다음 문단을 여는 위치 수 — 줄바꿈 한 글자 자리가 문단 경계 둘이 된다 */
const PARAGRAPH_BOUNDARY_TOKENS = 2;

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
export function carriedAttrs(old: Node, type: NodeType, attrs: Attrs | null): Attrs {
  const spec = type.spec.attrs ?? {};
  const carried = TEXTBLOCK_DECORATION_KEYS.filter(
    (key) => Object.hasOwn(spec, key) && old.attrs[key] != null,
  ).map((key) => [key, old.attrs[key]]);
  return { ...Object.fromEntries(carried), ...attrs };
}

/**
 * 여러 줄 코드 블록을 줄마다 문단으로. 꾸미기(스티커 등)는 첫 문단에만 옮긴다 — 나누면 문서 상한을 넘는다.
 * 커서는 원래 있던 줄 · 칸으로 옮긴다. https://prosemirror.net/docs/ref/#transform.Transform.replaceWith
 */
function splitIntoParagraphs(
  state: EditorState,
  target: { pos: number; node: Node },
  lines: string[],
  attrs: Attrs | null,
): Transaction {
  const { paragraph } = state.schema.nodes as { paragraph: NodeType };
  const paragraphs = lines.map((line, index) =>
    paragraph.create(
      index === 0 ? carriedAttrs(target.node, paragraph, attrs) : attrs,
      line === "" ? null : state.schema.text(line),
    ),
  );
  const tr = state.tr.replaceWith(target.pos, target.pos + target.node.nodeSize, paragraphs);
  let offset = state.selection.$from.parentOffset;
  let pos = target.pos + 1;
  for (const line of lines) {
    if (offset <= line.length) break;
    offset -= line.length + 1;
    pos += line.length + PARAGRAPH_BOUNDARY_TOKENS;
  }
  return tr.setSelection(TextSelection.create(tr.doc, pos + offset));
}

/** 코드 블록이면 줄 목록, 아니면 빈 목록 */
const codeLinesOf = (node: Node): string[] =>
  node.type.spec.code === true ? node.textContent.split("\n") : [];

/**
 * 공백이 가질 마크 — 양쪽 글자가 함께 가진 마크(굵은 두 줄이면 공백도 굵어 한 덩어리로 이어진다). 한쪽이 글자가 아니면
 * 강제 줄바꿈 자신의 마크(에디터 안에서는 마크 붙이기가 실을 수 있다 — doc-node.ts withoutHardBreakMarks).
 */
function spaceMarks(before: Node | null, hardBreak: Node, after: Node | null): readonly Mark[] {
  if (before?.isText !== true || after?.isText !== true) return hardBreak.marks;
  return before.marks.filter((mark) => mark.isInSet(after.marks));
}

/**
 * 강제 줄바꿈 자리가 없는 한 줄 블록(제목)으로 바꿀 때는 강제 줄바꿈을 공백 하나로 먼저 바꾼다 — setBlockType은 그
 * 노드를 지워 두 줄 글자가 붙어 버린다(prosemirror-transform 1.12.1 structure.ts setBlockType → clearIncompatible).
 * 코드 블록(`whitespace: "pre"`)은 setBlockType이 줄바꿈 글자로 바꾸므로(linebreakReplacement) 그대로 둔다.
 * https://prosemirror.net/docs/ref/#model.NodeSpec.linebreakReplacement
 */
function hardBreaksAsSpaces(
  tr: Transaction,
  target: { pos: number; node: Node },
  type: NodeType,
): Transaction {
  const hardBreak = type.schema.nodes.hardBreak;
  if (hardBreak === undefined || type.whitespace === "pre") return tr;
  if (type.contentMatch.matchType(hardBreak) !== null) return tr;
  const spaces: { pos: number; marks: readonly Mark[] }[] = [];
  const { node } = target;
  node.forEach((child, offset, index) => {
    if (child.type !== hardBreak) return;
    const before = index > 0 ? node.child(index - 1) : null;
    const after = index + 1 < node.childCount ? node.child(index + 1) : null;
    spaces.push({ pos: target.pos + 1 + offset, marks: spaceMarks(before, child, after) });
  });
  // 노드 하나를 글자 하나로 바꾸니 크기는 같지만, 뒤에서부터 바꿔 앞 자리를 믿지 않아도 되게 한다
  for (const { pos, marks } of spaces.reverse()) {
    tr.replaceWith(pos, pos + 1, type.schema.text(" ", marks));
  }
  return tr;
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
    const lines = codeLinesOf(target.node);
    const isMultilineCode = lines.length > 1;
    if (isMultilineCode) {
      // 여러 줄 코드는 문단이면 줄마다 하나로 나누고, 한 줄짜리 블록(제목)으로는 합치지 않는다(design.md 4)
      if (type !== state.schema.nodes.paragraph) return false;
      if (dispatch) dispatch(splitIntoParagraphs(state, target, lines, attrs).scrollIntoView());
      return true;
    }
    if (dispatch) {
      const from = target.pos + 1;
      const tr = hardBreaksAsSpaces(state.tr, target, type);
      tr.setBlockType(from, from + tr.doc.nodeAt(target.pos)!.content.size, type, (old) =>
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
