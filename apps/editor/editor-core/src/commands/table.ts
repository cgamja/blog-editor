/**
 * 표 커맨드 — spec: editor-table, adr-028. 편집 엔진은 prosemirror-tables(`@tiptap/pm/tables` 1.8.5)이고 여기서는
 * 우리 규칙 두 가지만 더한다: 첫 행이 머리 행이라 열 정렬은 머리 행 칸에만 둔다, 칸 병합은 없다. 근거 문서:
 * - prosemirror-tables README(Commands · Utilities · TableMap) — node_modules/prosemirror-tables/README.md
 * - `addRow` · `addColumn` · `removeRow` · `selectedRect` · `goToNextCell` 동작은 dist/index.js 1.8.5 소스로 확인
 *   (addRow는 새 칸에 attrs를 복사하지 않는다 — `type.createAndFill()`)
 * - Command: https://prosemirror.net/docs/ref/#state.Command
 * - Transform.setNodeAttribute: https://prosemirror.net/docs/ref/#transform.Transform.setNodeAttribute
 */
import type { Attrs, Node, Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command, Transaction } from "@tiptap/pm/state";
import {
  TableMap,
  addColumnAfter,
  addRow,
  deleteColumn,
  deleteRow,
  goToNextCell,
  isInTable,
  selectedRect,
} from "@tiptap/pm/tables";
import { defaultAlignOf } from "@blog-editor/content-schema";
import { alignOrNull } from "../closed-values";
import { appendCommandStepsAndSelection } from "./derived-command";
import { blockStart } from "./move-block";

const ALIGN_KEY = "align";
const CELL = "tableCell";

/** rows × columns 빈 표 — 칸마다 빈 문단 하나(`createAndFill`). 스키마에 표가 없으면 null */
export function createTable(
  schema: Schema,
  rows: number,
  columns: number,
  attrs: Attrs | null = null,
): Node | null {
  const { table, tableRow, tableCell } = schema.nodes;
  if (table === undefined || tableRow === undefined || tableCell === undefined) return null;
  const cells = () =>
    Array.from({ length: columns }, () => tableCell.createAndFill()).filter(
      (cell): cell is Node => cell !== null,
    );
  return table.create(
    attrs,
    Array.from({ length: rows }, () => tableRow.create(null, cells())),
  );
}

/** 표 안 row행 col열 칸의 첫 글자 자리 — 칸 안은 문단 하나라 칸 시작 + 2다 */
function cellTextPos(tableNode: Node, tableStart: number, row: number, col: number): number {
  const map = TableMap.get(tableNode);
  return tableStart + map.positionAt(row, col, tableNode) + 2;
}

/** 머리 행 칸들의 정렬(열 순서) — 저장값 그대로(null은 정렬 없음) */
function headerAligns(tableNode: Node): unknown[] {
  const head = tableNode.firstChild;
  if (head === null) return [];
  return Array.from({ length: head.childCount }, (_, col) => head.child(col).attrs[ALIGN_KEY]);
}

/** 트랜잭션 뒤 표를 다시 찾는다 — 표 자신의 위치는 표 안 편집으로 움직이지 않는다 */
function tableAfter(tr: Transaction, tableStart: number): Node | null {
  const node = tr.doc.nodeAt(tableStart - 1);
  return node !== null && node.type.spec.tableRole === "table" ? node : null;
}

/** 커서가 든 칸 아래에 행을 더한다. 새 칸에는 정렬이 없다 — 열 정렬은 머리 행 칸에 있다 */
export const addTableRowAfter: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  if (dispatch) {
    const rect = selectedRect(state);
    const tr = addRow(state.tr, rect, rect.bottom);
    const table = tableAfter(tr, rect.tableStart);
    if (table !== null) {
      tr.setSelection(
        TextSelection.create(tr.doc, cellTextPos(table, rect.tableStart, rect.bottom, rect.left)),
      );
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** 커서가 든 칸 오른쪽에 열을 더한다 — prosemirror-tables 그대로(새 칸은 정렬 없음) */
export const addTableColumnAfter: Command = (state, dispatch) =>
  isInTable(state) && addColumnAfter(state, dispatch);

/**
 * 커서가 든 행을 지운다. 머리 행을 지우면 다음 행이 머리 행이 되므로 열 정렬을 그 행으로 옮긴다(adr-028).
 * 마지막 남은 행이면 false(prosemirror-tables `deleteRow`가 모든 행 선택을 거절한다). 커서는 같은 열의 칸으로.
 */
export const deleteTableRow: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  const aligns = headerAligns(rect.table);
  let deleted: Transaction | null = null;
  if (!deleteRow(state, (tr) => (deleted = tr))) return false;
  if (dispatch && deleted !== null) {
    const tr: Transaction = deleted;
    const table = tableAfter(tr, rect.tableStart);
    if (table !== null) {
      if (rect.top === 0) carryHeaderAligns(tr, table, rect.tableStart, aligns);
      const row = Math.min(rect.top, table.childCount - 1);
      tr.setSelection(
        TextSelection.create(tr.doc, cellTextPos(table, rect.tableStart, row, rect.left)),
      );
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** 새 머리 행 칸에 옛 머리 행의 열 정렬을 싣는다 — 새 머리 행이던 본문 칸에는 정렬이 없다 */
function carryHeaderAligns(tr: Transaction, table: Node, tableStart: number, aligns: unknown[]) {
  const map = TableMap.get(table);
  aligns.forEach((align, col) => {
    if (align == null || col >= map.width) return;
    tr.setNodeAttribute(tableStart + map.map[col]!, ALIGN_KEY, align);
  });
}

/** 커서가 든 열을 지운다. 마지막 남은 열이면 false. 커서는 같은 행의 칸으로 */
export const deleteTableColumn: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  let deleted: Transaction | null = null;
  if (!deleteColumn(state, (tr) => (deleted = tr))) return false;
  if (dispatch && deleted !== null) {
    const tr: Transaction = deleted;
    const table = tableAfter(tr, rect.tableStart);
    if (table !== null) {
      const col = Math.min(rect.left, TableMap.get(table).width - 1);
      tr.setSelection(
        TextSelection.create(tr.doc, cellTextPos(table, rect.tableStart, rect.top, col)),
      );
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * 커서(또는 칸 선택)가 걸친 열의 정렬을 바꾼다 — 머리 행 칸에만 저장하고, 기본 모양(left)은 저장하지 않는다
 * (정규형 defaultAlignOf와 같은 규칙). 집합 밖 값 · 표 밖이면 false, 이미 그 모양이면 true이되 dispatch 없음.
 */
export function setTableColumnAlign(align: string): Command {
  const value = alignOrNull(align);
  if (value === null) return () => false;
  const stored = value === defaultAlignOf(CELL) ? null : value;
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    const { left, right, map, table, tableStart } = selectedRect(state);
    const targets: number[] = [];
    for (let col = left; col < right; col += 1) {
      const pos = map.map[col]!;
      if ((table.nodeAt(pos)?.attrs[ALIGN_KEY] ?? null) !== stored) targets.push(tableStart + pos);
    }
    if (dispatch && targets.length > 0) {
      const tr = state.tr;
      for (const pos of targets) tr.setNodeAttribute(pos, ALIGN_KEY, stored);
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Tab — 다음 칸으로. 마지막 칸이면 아래에 행을 더하고 새 행 첫 칸으로 간다(spec: editor-table).
 * 표 밖이면 false(다른 키 처리로 넘긴다).
 */
export const nextCellOrNewRow: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  if (goToNextCell(1)(state, dispatch)) return true;
  if (dispatch) {
    const rect = selectedRect(state);
    const tr = addRow(state.tr, rect, rect.map.height);
    const table = tableAfter(tr, rect.tableStart);
    if (table !== null) {
      tr.setSelection(
        TextSelection.create(tr.doc, cellTextPos(table, rect.tableStart, rect.map.height, 0)),
      );
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Shift+Tab — 앞 칸으로. 첫 칸이면 아무것도 바꾸지 않되 키는 삼킨다(포커스가 에디터를 떠나지 않게) */
export const previousCell: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  goToNextCell(-1)(state, dispatch);
  return true;
};

/** Enter — 칸 안에는 문단이 하나뿐이라 나눌 자리가 없다. 표 안이면 문서를 바꾸지 않고 키를 삼킨다 */
export const enterInTable: Command = (state) => isInTable(state);

/** 최상위 `index`번째 블록이 표면 그 마지막 칸 안 선택 — 블록 메뉴의 기준 칸(커서가 그 표 밖일 때) */
function lastCellSelection(doc: Node, index: number): TextSelection | null {
  const table = doc.child(index);
  if (table.type.spec.tableRole !== "table") return null;
  const map = TableMap.get(table);
  const tableStart = blockStart(doc, index) + 1;
  return TextSelection.create(doc, cellTextPos(table, tableStart, map.height - 1, map.width - 1));
}

/**
 * 블록 메뉴(손잡이)가 표 커맨드를 부른다 — 커서가 그 표 안이면 커서 칸, 아니면 마지막 칸 기준(spec: editor-table).
 * 선택만 다른 상태에서 돈 step을 지금 트랜잭션에 옮긴다(atTopBlock과 같은 방식, derived-command).
 */
export function atTopTable(index: number, command: Command): Command {
  return (state, dispatch) => {
    const { doc, selection } = state;
    if (!Number.isInteger(index) || index < 0 || index >= doc.childCount) return false;
    const start = blockStart(doc, index);
    const inside = selection.from > start && selection.to < start + doc.child(index).nodeSize;
    if (inside) return command(state, dispatch);
    const fallback = lastCellSelection(doc, index);
    if (fallback === null) return false;
    const derived = EditorState.create({ doc, selection: fallback, plugins: state.plugins });
    if (dispatch === undefined) return command(derived);
    const tr = state.tr;
    const outcome = appendCommandStepsAndSelection(tr, derived, command);
    if (outcome === "applied") dispatch(tr);
    return outcome !== "rejected";
  };
}
