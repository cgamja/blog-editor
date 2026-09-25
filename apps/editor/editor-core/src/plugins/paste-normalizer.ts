import { Fragment, Slice } from "@tiptap/pm/model";
import type { Attrs, Mark, Node, ResolvedPos } from "@tiptap/pm/model";
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

/** 붙일 자리 — 선택(붙여넣기)이나 놓는 자리(끌어 놓기)에서 정한다 */
interface PastePlace {
  intoTopLevel: boolean;
  intoTableCell: boolean;
  intoHeading: boolean;
}

/**
 * `$pos` 자리의 붙일 자리. 노드 선택이면 $from이 선택된 노드의 부모 안이다 — 그 노드가 최상위일 때(깊이 0)만 최상위
 * 자리이고, 제목 글자 안이 아니다.
 */
function placeAt($pos: ResolvedPos, nodeSelected: boolean): PastePlace {
  let intoTableCell = false;
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.spec.tableRole === "cell") intoTableCell = true;
  }
  return {
    intoTopLevel: nodeSelected ? $pos.depth === 0 : $pos.depth <= TOP_LEVEL_DEPTH,
    intoTableCell,
    intoHeading: !nodeSelected && $pos.parent.type.name === "heading",
  };
}

const placeOfSelection = (selection: Selection) =>
  placeAt(selection.$from, selection instanceof NodeSelection);

export function isTopLevelTarget(selection: Selection): boolean {
  return placeOfSelection(selection).intoTopLevel;
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
  return placeOfSelection(selection).intoTableCell;
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

const isHardBreak = (node: Node) => node.type === node.type.schema.nodes.hardBreak;

/** 강제 줄바꿈 → 공백 하나 — 표 칸 · 제목은 한 줄 문법이라 강제 줄바꿈 자리가 없다(adr-028) */
const asOneLineInline = (node: Node) => (isHardBreak(node) ? node.type.schema.text(" ") : node);

/** 선택이 제목 안인가 — 조각 앞쪽의 열린 글자가 제목으로 들어간다 */
export function isHeadingTarget(selection: Selection): boolean {
  return placeOfSelection(selection).intoHeading;
}

function withInlines(block: Node, map: (inline: Node) => Node): Node {
  const inlines: Node[] = [];
  block.forEach((inline) => inlines.push(map(inline)));
  return block.type.create(block.attrs, Fragment.fromArray(inlines), block.marks);
}

/**
 * 조각의 첫 텍스트 블록(열린 깊이 `depth`까지 첫 자식을 따라 내려간 것)의 강제 줄바꿈을 공백으로 — 열린 조각을 제목
 * 가운데에 붙이면 그 글자가 제목으로 합쳐진다(prosemirror-transform Fitter). 그대로 두면 제목에 자리가 없는 강제
 * 줄바꿈 앞에서 제목이 나뉘어, 강제 줄바꿈으로 시작하는 문단이 남는다.
 */
function leadingLineAsOneLine(node: Node, depth: number): Node {
  if (depth <= 0) return node;
  if (node.isTextblock) return withInlines(node, asOneLineInline);
  const first = node.firstChild;
  if (first === null) return node;
  return node.copy(node.content.replaceChild(0, leadingLineAsOneLine(first, depth - 1)));
}

/**
 * 칸 안에 여러 블록을 붙이면 한 줄로 합친다(블록 사이는 공백 하나, 강제 줄바꿈도 공백 — 표 칸에는 강제 줄바꿈이
 * 없다, adr-028). 칸 안은 문단 하나라 그대로 두면 Fitter가 표를 쪼개고 blockGuard가 거부한다. 그림 같은 글자
 * 없는 블록은 빠진다.
 */
function inlineForCell(slice: Slice): Slice {
  const pieces: Node[] = [];
  slice.content.descendants((node) => {
    if (!node.isTextblock) return true;
    if (node.content.size > 0) {
      if (pieces.length > 0) pieces.push(node.type.schema.text(" "));
      node.content.forEach((inline) => pieces.push(asOneLineInline(inline)));
    }
    return false;
  });
  return pieces.length === 0 ? Slice.empty : new Slice(Fragment.fromArray(pieces), 0, 0);
}

/** 칸 안 문단의 강제 줄바꿈을 공백으로 — 붙인 표의 `<td>…<br>…</td>`도 같다 */
function cellWithoutHardBreaks(cell: Node): Node {
  const blocks: Node[] = [];
  cell.forEach((block) => blocks.push(withInlines(block, asOneLineInline)));
  return cell.type.create(cell.attrs, Fragment.fromArray(blocks), cell.marks);
}

function cleanNode(node: Node, isSliceTop: boolean, intoTopLevel: boolean): Node | null {
  if (node.isText) return node.mark(allowedMarks(node.marks));
  // DOMParser는 인라인 노드에 그 자리의 마크를 붙인다(`<b>가<br>나</b>`) — 강제 줄바꿈에는 마크 자리가 없다.
  // prosemirror-model 1.25.12 from_dom.ts `insertNode`가 `node.mark(nodeMarks)`로 싣는다
  // https://github.com/ProseMirror/prosemirror-model/blob/1.25.12/src/from_dom.ts#L641-L659
  if (isHardBreak(node)) return node.mark([]);
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
  if (node.type.spec.tableRole === "cell") return cellWithoutHardBreaks(cleaned);
  return node.type.spec.tableRole === "table" ? rectangularTable(cleaned) : cleaned;
}

/**
 * 붙일 자리에 맞추기 — 칸 자리의 표 정렬 · 칸에 붙이는 여러 블록 합치기 · 제목 · 표 칸 자리의 한 줄. 값은 이미 거른
 * 노드를 받는다(에디터 안 끌어 옮기기는 거르지 않은 조각을 그대로 넘긴다 — 스티커를 지키려고).
 */
function fitPlace(nodes: Node[], slice: Slice, place: PastePlace): Slice {
  if (nodes.length === 0) return Slice.empty;
  const { intoTableCell } = place;
  const cellPieces = nodes.some((node) => ["row", "cell"].includes(node.type.spec.tableRole));
  // 표 조각은 prosemirror-tables handlePaste가 칸으로 넣는다 — 칸 자리이거나 칸 조각이면 정렬만 지운다
  const fixed = intoTableCell || cellPieces ? nodes.map(withoutCellAligns) : nodes;
  const allInline = fixed.every((node) => node.isInline);
  // 표 조각만이면 prosemirror-tables가 칸으로 넣는다. 문단과 섞인 표는 칸으로 넣을 수 없어 글자만 한 줄로 합친다
  if (intoTableCell && !fixed.every(isTablePart) && !allInline) {
    return inlineForCell(new Slice(Fragment.fromArray(fixed), slice.openStart, slice.openEnd));
  }
  // 제목 · 표 칸 자리로 들어가는 글자는 한 줄이다 — 인라인 조각은 전부, 열린 블록 조각은 제목에 합쳐지는 첫 줄만
  const intoOneLine = intoTableCell || place.intoHeading;
  let oneLine = fixed;
  if (intoOneLine && allInline) oneLine = fixed.map(asOneLineInline);
  else if (intoOneLine && slice.openStart > 0) {
    oneLine = [leadingLineAsOneLine(fixed[0]!, slice.openStart), ...fixed.slice(1)];
  }
  // 지우는 것은 원자 노드뿐이라 열린 끝(openStart · openEnd)은 그대로 둔다(design.md 4)
  return new Slice(Fragment.fromArray(oneLine), slice.openStart, slice.openEnd);
}

export function normalizePastedSlice(
  slice: Slice,
  options: { intoTopLevel: boolean; intoTableCell?: boolean; intoHeading?: boolean },
): Slice {
  const nodes: Node[] = [];
  slice.content.forEach((node) => {
    const cleaned = cleanNode(node, true, options.intoTopLevel);
    if (cleaned !== null) nodes.push(cleaned);
  });
  return fitPlace(nodes, slice, {
    intoTopLevel: options.intoTopLevel,
    intoTableCell: options.intoTableCell ?? false,
    intoHeading: options.intoHeading ?? false,
  });
}

/**
 * 끌어 놓는 조각 — 붙일 자리를 선택이 아니라 놓는 자리 `$drop`으로 정한다(선택은 끄는 쪽에 있거나, 다른 탭에서 끌어 오면
 * 무관하다). 에디터 안 끌어 옮기기(`moving`)는 파싱 없이 내부 조각이 그대로 오고 이미 저장 가능한 모양이라 값은 거르지
 * 않는다 — 스티커를 지우면 옮기다 잃는다. 자리 맞추기(한 줄 · 칸)만 한다.
 */
export function normalizeDroppedSlice(
  slice: Slice,
  $drop: ResolvedPos,
  options: { moving: boolean },
): Slice {
  const place = placeAt($drop, false);
  if (!options.moving) return normalizePastedSlice(slice, place);
  const nodes: Node[] = [];
  slice.content.forEach((node) => nodes.push(node));
  return fitPlace(nodes, slice, place);
}

export const pasteNormalizerKey = new PluginKey("pasteNormalizer");

/**
 * 붙여넣기 · 끌어 놓기 정규화. `transformPasted`는 놓는 자리를 받지 않는다(slice · view · plain뿐) — 끌어 놓기에서도
 * prosemirror-view 1.42.5 handleDrop이 같은 훅을 부른다(에디터 안 끌기는 input.ts:790, 밖에서 끌어 오면
 * parseFromClipboard 안 clipboard.ts:108). 그래서 drop DOM 이벤트에서 놓는 자리를 먼저 적어 둔다 — handleDOMEvents는
 * 기본 drop 처리보다 먼저 돈다(input.ts:50 runCustomHandler). 자리는 handleDrop과 같게 `posAtCoords(clientX · clientY)`
 * (input.ts:163 eventCoords · :785)로 잰다.
 * 적어 둔 자리는 그 놓기 이벤트 안에서만 쓴다. 한 drop 리스너 안에서 handleDOMEvents(runCustomHandler) → 기본
 * editHandlers.drop → handleDrop → transformPasted가 await 없이 이어서 돈다(input.ts:49-52 · :774-776 · :790,
 * 밖에서 끌어 오면 :792 parseFromClipboard → clipboard.ts:108). 그래서 마이크로태스크로 지우면 같은 놓기의
 * transformPasted는 읽고, 뒤의 붙여넣기는 읽지 못한다. 앞선 플러그인의 handleDrop이 true를 돌려(예: 파일 놓기,
 * image-file-input) 기본 놓기가 transformPasted까지 가지 않아도 자리가 남지 않는다. 붙여넣기 이벤트에서도 지운다.
 * https://prosemirror.net/docs/ref/#view.EditorProps.transformPasted ·
 * https://prosemirror.net/docs/ref/#view.EditorProps.handleDOMEvents
 */
export function pasteNormalizer(): Plugin {
  let dropAt: ResolvedPos | null = null;
  return new Plugin({
    key: pasteNormalizerKey,
    props: {
      handleDOMEvents: {
        drop: (view, event) => {
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const $drop = at === null ? null : view.state.doc.resolve(at.pos);
          dropAt = $drop;
          // 마이크로태스크 — editor-core는 DOM · Node 타입 없이 빌드하므로 queueMicrotask 대신 ES Promise
          void Promise.resolve().then(() => {
            if (dropAt === $drop) dropAt = null;
          });
          return false;
        },
        paste: () => {
          dropAt = null;
          return false;
        },
      },
      transformPasted: (slice, view) => {
        const $drop = dropAt;
        dropAt = null;
        const moving = view.dragging?.move ?? false;
        if ($drop !== null) return normalizeDroppedSlice(slice, $drop, { moving });
        // 놓는 자리를 못 잰 에디터 안 끌어 옮기기는 옛 동작 그대로 — 안쪽에 떨어져 무효가 되면 blockGuard가 막는다
        if (moving) return slice;
        return normalizePastedSlice(slice, placeOfSelection(view.state.selection));
      },
    },
  });
}
