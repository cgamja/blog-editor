import type { Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { docSchema, normalize } from "@blog-editor/content-schema";
import {
  addTableColumnAfter,
  addTableRowAfter,
  blockGuard,
  createEditorSchema,
  deleteTableColumn,
  deleteTableRow,
  docFromNode,
  docToNode,
  setTableColumnAlign,
  tableKeymap,
  tablePlugins,
} from "../index";
import { replaceEmptyTopParagraph } from "./drag-block";

const schema = createEditorSchema();

const HEART = { id: "heart", x: 50, y: 50, size: 10, rotate: 0 };

interface CellSpec {
  text?: string;
  align?: string;
}

const cellOf = ({ text, align }: CellSpec) => ({
  type: "tableCell",
  ...(align === undefined ? {} : { attrs: { align } }),
  content: [
    text === undefined
      ? { type: "paragraph" }
      : { type: "paragraph", content: [{ type: "text", text }] },
  ],
});

const tableOf = (rows: CellSpec[][], attrs?: Record<string, unknown>) => ({
  type: "table",
  ...(attrs === undefined ? {} : { attrs }),
  content: rows.map((cells) => ({ type: "tableRow", content: cells.map(cellOf) })),
});

/** row행 col열 칸 안 문단의 첫 글자 자리 */
function cellTextStart(doc: Node, row: number, col: number): number {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null || node.type.name !== "table") return found === null;
    let rowPos = pos + 1;
    for (let r = 0; r < row; r += 1) rowPos += node.child(r).nodeSize;
    let cellPos = rowPos + 1;
    const rowNode = node.child(row);
    for (let c = 0; c < col; c += 1) cellPos += rowNode.child(c).nodeSize;
    found = cellPos + 2;
    return false;
  });
  if (found === null) throw new Error("표가 없다");
  return found;
}

/** blockGuard와 표 플러그인을 단 상태 — 커서는 첫 표의 row행 col열 칸 */
function stateIn(content: object[], row = 0, col = 0): EditorState {
  const doc = docToNode(schema, { type: "doc", content });
  const state = EditorState.create({ doc, plugins: [blockGuard(), ...tablePlugins()] });
  return state.apply(
    state.tr.setSelection(TextSelection.create(doc, cellTextStart(doc, row, col))),
  );
}

function run(command: Command, state: EditorState): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = next.apply(tr);
  });
  return { ok, state: next };
}

function press(key: string, state: EditorState) {
  const command = tableKeymap[key];
  if (command === undefined) throw new Error(`${key} 키가 없다`);
  return run(command, state);
}

/** 첫 표의 [행 수, 열 수] */
function shapeOf(doc: Node): [number, number] {
  const table = doc.children.find((child) => child.type.name === "table");
  if (table === undefined) throw new Error("표가 없다");
  return [table.childCount, table.firstChild?.childCount ?? 0];
}

/** 커서가 든 칸의 [행, 열] */
function cursorCell(state: EditorState): [number, number] {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "tableCell") {
      return [$from.index(depth - 2), $from.index(depth - 1)];
    }
  }
  throw new Error("커서가 칸 안에 없다");
}

describe("editor-table: 에디터는 표를 저장 문서와 같은 모양으로 오간다", () => {
  it("WHEN 머리 행 정렬 · 꾸미기가 있는 표 문서를 docToNode → docFromNode로 돌린다 THEN normalize 결과와 같고 colspan · rowspan 키가 없다", () => {
    const doc = {
      type: "doc",
      content: [
        tableOf(
          [
            [{ text: "이름" }, { text: "값", align: "right" }],
            [{ text: "가" }, {}],
          ],
          { font: "jua", stickers: [HEART] },
        ),
      ],
    };
    const back = docFromNode(docToNode(schema, doc));
    expect(back).toEqual(normalize(docSchema.parse(doc)));
    expect(JSON.stringify(back)).not.toMatch(/colspan|rowspan/);
  });
});

describe("editor-table: 표를 넣고 칸 사이를 키보드로 옮겨 다닌다", () => {
  it("WHEN 빈 문단 자리에 표를 넣고 첫 칸에 가를 치고 Enter 뒤 Tab을 네 번 누른다 THEN Enter는 문서를 그대로 두고 칸을 옮기다 마지막 칸에서 행을 더한다", () => {
    const empty = EditorState.create({
      doc: docToNode(schema, { type: "doc", content: [{ type: "paragraph" }] }),
      plugins: [blockGuard(), ...tablePlugins()],
    });
    const inserted = run(replaceEmptyTopParagraph(0, "table"), empty);
    expect(inserted.ok).toBe(true);
    expect(shapeOf(inserted.state.doc)).toEqual([2, 2]);
    expect(cursorCell(inserted.state)).toEqual([0, 0]);

    const typed = inserted.state.apply(inserted.state.tr.insertText("가"));
    const entered = press("Enter", typed);
    expect(entered.state.doc.eq(typed.doc)).toBe(true);

    const first = press("Tab", entered.state);
    expect(cursorCell(first.state)).toEqual([0, 1]);
    const second = press("Tab", first.state);
    expect(cursorCell(second.state)).toEqual([1, 0]);
    const fourth = press("Tab", press("Tab", second.state).state);
    expect(shapeOf(fourth.state.doc)).toEqual([3, 2]);
    expect(cursorCell(fourth.state)).toEqual([2, 0]);
    expect(fourth.state.doc.firstChild?.firstChild?.firstChild?.textContent).toBe("가");
  });
});

describe("editor-table: 행 · 열을 더하고 지우며 열 정렬을 바꾼다", () => {
  const grid = (rows: number, cols: number): CellSpec[][] =>
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({ text: `${r}${c}` })),
    );

  it("WHEN 2×2 표 첫 칸에서 열 · 행을 더하고 이어 행 · 열을 지운다 THEN 3×2 → 3×3 → 2×3 → 2×2이고 매번 docSchema를 통과한다", () => {
    let state = stateIn([tableOf(grid(2, 2))]);
    const shapes: [number, number][] = [];
    for (const command of [
      addTableColumnAfter,
      addTableRowAfter,
      deleteTableRow,
      deleteTableColumn,
    ]) {
      const result = run(command, state);
      expect(result.ok).toBe(true);
      state = result.state;
      const [rows, cols] = shapeOf(state.doc);
      shapes.push([cols, rows]);
      expect(docSchema.safeParse(docFromNode(state.doc)).success).toBe(true);
    }
    expect(shapes).toEqual([
      [3, 2],
      [3, 3],
      [3, 2],
      [2, 2],
    ]);
  });

  it("WHEN 둘째 열이 right인 3행 표의 머리 행 칸에서 행을 지운다 THEN 2행이고 새 첫 행 둘째 칸만 right다", () => {
    const rows = grid(3, 2);
    rows[0]![1] = { text: "01", align: "right" };
    const result = run(deleteTableRow, stateIn([tableOf(rows)], 0, 0));
    expect(result.ok).toBe(true);
    const saved = docFromNode(result.state.doc);
    expect(saved.content[0]).toEqual(
      tableOf([
        [{ text: "10" }, { text: "11", align: "right" }],
        [{ text: "20" }, { text: "21" }],
      ]),
    );
  });

  it("WHEN 둘째 행 둘째 칸에서 열 정렬을 center로, 이어 left로 바꾼다 THEN 처음엔 첫 행 둘째 칸만 center이고 다음엔 align이 없다", () => {
    const centered = run(setTableColumnAlign("center"), stateIn([tableOf(grid(2, 2))], 1, 1));
    expect(centered.ok).toBe(true);
    expect(docFromNode(centered.state.doc).content[0]).toEqual(
      tableOf([
        [{ text: "00" }, { text: "01", align: "center" }],
        [{ text: "10" }, { text: "11" }],
      ]),
    );
    const left = run(setTableColumnAlign("left"), centered.state);
    expect(docFromNode(left.state.doc).content[0]).toEqual(tableOf(grid(2, 2)));
  });

  it("WHEN 1행 표에서 행 지우기, 1열 표에서 열 지우기, 표 밖 문단에서 행 더하기 THEN 셋 다 false이고 문서가 그대로다", () => {
    const oneRow = stateIn([tableOf(grid(1, 2))]);
    const oneCol = stateIn([tableOf(grid(2, 1))]);
    const outsideDoc = docToNode(schema, {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "밖" }] },
        tableOf(grid(2, 2)),
      ],
    });
    const outside = EditorState.create({
      doc: outsideDoc,
      selection: TextSelection.create(outsideDoc, 1),
      plugins: [blockGuard(), ...tablePlugins()],
    });
    for (const [command, state] of [
      [deleteTableRow, oneRow],
      [deleteTableColumn, oneCol],
      [addTableRowAfter, outside],
    ] as const) {
      const result = run(command, state);
      expect(result.ok).toBe(false);
      expect(result.state.doc.eq(state.doc)).toBe(true);
    }
  });
});
