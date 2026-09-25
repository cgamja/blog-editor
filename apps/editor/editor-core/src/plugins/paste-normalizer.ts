import { Fragment, Slice } from "@tiptap/pm/model";
import type { Attrs, Mark, Node } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import type { Selection } from "@tiptap/pm/state";
import {
  fontOrNull,
  hrefOrNull,
  imagePathOrNull,
  languageOrNull,
  motionOrNull,
  naturalSizeFrom,
  widthOrNull,
} from "../closed-values";

/**
 * 붙여넣은 조각을 넣을 자리에 맞게 저장 가능한 모양으로 만든다(spec: editor-paste, design.md 4).
 * 파싱 규칙이 값은 이미 걸렀지만 붙일 자리는 모른다 — 안쪽 노드에는 꾸밈 자리가 없다.
 * 복사 · 붙여넣기(에디터 안 포함)는 클립보드 HTML을 파싱 규칙으로 읽고, 규칙을 거치지 않는 경로는
 * 에디터 안 드래그다. 이 함수는 어느 경로인지 모르므로 값 검증도 한 번 더 한다.
 * 근거: https://prosemirror.net/docs/ref/#view.EditorProps.transformPasted
 */

const DECORATION_VALUES = { font: fontOrNull, motion: motionOrNull, width: widthOrNull } as const;
const MEDIA_NODES = new Set(["image", "appScreenshot"]);
// 텍스트 선택이 이 깊이 이하면 최상위 블록 안이다 — 붙인 조각의 최상위 노드가 최상위 블록이 된다
const TOP_LEVEL_DEPTH = 1;

/** 노드 선택이면 $from이 선택된 노드의 부모 안이다 — 그 노드가 최상위일 때(깊이 0)만 최상위 자리다. */
export function isTopLevelTarget(selection: Selection): boolean {
  return selection instanceof NodeSelection
    ? selection.$from.depth === 0
    : selection.$from.depth <= TOP_LEVEL_DEPTH;
}

function cleanAttrs(node: Node, keepDecoration: boolean): Attrs {
  const attrs: Record<string, unknown> = { ...node.attrs };
  if ("stickers" in attrs) attrs.stickers = null;
  for (const [key, valueOrNull] of Object.entries(DECORATION_VALUES)) {
    if (key in attrs) attrs[key] = keepDecoration ? valueOrNull(attrs[key]) : null;
  }
  if ("naturalWidth" in attrs) {
    const size = naturalSizeFrom(attrs.naturalWidth, attrs.naturalHeight);
    attrs.naturalWidth = size?.width ?? null;
    attrs.naturalHeight = size?.height ?? null;
  }
  if ("language" in attrs) attrs.language = languageOrNull(attrs.language);
  return attrs;
}

const allowedMarks = (marks: readonly Mark[]) =>
  marks.filter((mark) => mark.type.name !== "link" || hrefOrNull(mark.attrs.href) !== null);

/** 선택이 표 칸 안인가 — 붙인 칸은 본문 칸이 될 수 있고, 칸 안은 문단 하나라 여러 블록이 들어갈 자리가 없다 */
export function isTableCellTarget(selection: Selection): boolean {
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.spec.tableRole === "cell") return true;
  }
  return false;
}

const isTablePart = (node: Node) => node.type.spec.tableRole !== undefined;

function withoutAlign(cell: Node): Node {
  return cell.attrs.align == null
    ? cell
    : cell.type.create({ ...cell.attrs, align: null }, cell.content, cell.marks);
}

/**
 * 표를 저장 가능한 모양으로 — 열 정렬은 머리 행(첫 행) 칸에만(adr-028, 공개 HTML은 열의 모든 칸에 data-align을
 * 싣는다), 그리고 직사각형. 병합을 버린 표 · 행 길이가 다른 외부 표는 짧은 행 끝에 빈 칸을 채운다 — blockGuard
 * (filterTransaction)가 prosemirror-tables fixTables(appendTransaction)보다 먼저 거부해 붙여넣기가 통째로 사라진다.
 */
function rectangularTable(table: Node): Node {
  let width = 0;
  table.forEach((row) => (width = Math.max(width, row.childCount)));
  const rows: Node[] = [];
  table.forEach((row, _offset, rowIndex) => {
    const cells: Node[] = [];
    row.forEach((cell) => cells.push(rowIndex === 0 ? cell : withoutAlign(cell)));
    const filler = cells[0]?.type;
    while (filler !== undefined && cells.length < width) {
      const empty = filler.createAndFill();
      if (empty === null) break;
      cells.push(empty);
    }
    rows.push(row.type.create(row.attrs, Fragment.fromArray(cells)));
  });
  return table.type.create(table.attrs, Fragment.fromArray(rows), table.marks);
}

/** 칸 조각(맨 위가 행 · 칸)이나 칸 자리에 붙이는 표의 칸은 어느 행에 들어갈지 몰라 정렬을 모두 지운다 */
function withoutCellAligns(node: Node): Node {
  if (node.type.spec.tableRole === "cell") return withoutAlign(node);
  if (!isTablePart(node)) return node;
  const children: Node[] = [];
  node.forEach((child) => children.push(withoutCellAligns(child)));
  return node.type.create(node.attrs, Fragment.fromArray(children), node.marks);
}

/**
 * 칸 안에 여러 블록을 붙이면 한 줄로 합친다(블록 사이는 공백 하나 — 강제 줄바꿈 #131이 생기면 줄바꿈으로).
 * 칸 안은 문단 하나라 그대로 두면 Fitter가 표를 쪼개고 blockGuard가 거부한다. 그림 같은 글자 없는 블록은 빠진다.
 */
function inlineForCell(slice: Slice): Slice {
  const pieces: Node[] = [];
  slice.content.descendants((node) => {
    if (!node.isTextblock) return true;
    if (node.content.size > 0) {
      if (pieces.length > 0) pieces.push(node.type.schema.text(" "));
      node.content.forEach((inline) => pieces.push(inline));
    }
    return false;
  });
  return pieces.length === 0 ? Slice.empty : new Slice(Fragment.fromArray(pieces), 0, 0);
}

function cleanNode(node: Node, isSliceTop: boolean, intoTopLevel: boolean): Node | null {
  if (node.isText) return node.mark(allowedMarks(node.marks));
  if (MEDIA_NODES.has(node.type.name) && imagePathOrNull(node.attrs.src) === null) return null;
  const children: Node[] = [];
  node.forEach((child) => {
    const cleaned = cleanNode(child, false, intoTopLevel);
    if (cleaned !== null) children.push(cleaned);
  });
  const cleaned = node.type.create(
    cleanAttrs(node, intoTopLevel && isSliceTop),
    Fragment.fromArray(children),
    allowedMarks(node.marks),
  );
  return node.type.spec.tableRole === "table" ? rectangularTable(cleaned) : cleaned;
}

export function normalizePastedSlice(
  slice: Slice,
  options: { intoTopLevel: boolean; intoTableCell?: boolean },
): Slice {
  const intoTableCell = options.intoTableCell ?? false;
  const nodes: Node[] = [];
  slice.content.forEach((node) => {
    const cleaned = cleanNode(node, true, options.intoTopLevel);
    if (cleaned !== null) nodes.push(cleaned);
  });
  if (nodes.length === 0) return Slice.empty;
  const cellPieces = nodes.some((node) => ["row", "cell"].includes(node.type.spec.tableRole));
  // 표 조각은 prosemirror-tables handlePaste가 칸으로 넣는다 — 칸 자리이거나 칸 조각이면 정렬만 지운다
  const fixed = intoTableCell || cellPieces ? nodes.map(withoutCellAligns) : nodes;
  // 지우는 것은 원자 노드뿐이라 열린 끝(openStart · openEnd)은 그대로 둔다(design.md 4)
  const result = new Slice(Fragment.fromArray(fixed), slice.openStart, slice.openEnd);
  // 표 조각만이면 prosemirror-tables가 칸으로 넣는다. 문단과 섞인 표는 칸으로 넣을 수 없어 글자만 한 줄로 합친다
  const mustFlatten =
    intoTableCell && !fixed.every(isTablePart) && !fixed.every((node) => node.isInline);
  return mustFlatten ? inlineForCell(result) : result;
}

export const pasteNormalizerKey = new PluginKey("pasteNormalizer");

export function pasteNormalizer(): Plugin {
  return new Plugin({
    key: pasteNormalizerKey,
    props: {
      transformPasted: (slice, view) =>
        // 에디터 안 끌어 옮기기는 파싱 없이 내부 조각이 그대로 온다(prosemirror-view 1.42.5 handleDrop).
        // 이미 저장 가능한 모양이고 스티커를 지우면 옮기다 잃는다 — 안쪽에 떨어져 무효가 되면 blockGuard가 막는다
        view.dragging?.move
          ? slice
          : normalizePastedSlice(slice, {
              intoTopLevel: isTopLevelTarget(view.state.selection),
              intoTableCell: isTableCellTarget(view.state.selection),
            }),
    },
  });
}
