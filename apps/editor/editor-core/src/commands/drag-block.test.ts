import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command, Transaction } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import { history, undo } from "@tiptap/pm/history";
import { fixtures } from "@blog-editor/content-schema";
import { blockGuard, createEditorSchema, docFromNode, docToNode } from "../index";
import { blockIndexAt, dropGapAt, insertBlockAfter, moveTopBlockTo } from "./drag-block";
import { INSERTABLE_BLOCKS } from "./drag-block.constants";
import type { InsertableBlockKind } from "./drag-block.constants";

const schema = createEditorSchema();

const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value: string, attrs?: Record<string, unknown>) => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [text(value)],
});
const docOf = (...content: unknown[]) => docToNode(schema, { type: "doc", content });
const abc = () => docOf(paragraph("가나"), paragraph("다라"), paragraph("마바"));

function blockPos(doc: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return pos;
}

function run(command: Command, state: EditorState) {
  let tr: Transaction | null = null;
  const ok = command(state, (t) => {
    tr = t;
  });
  return { ok, next: tr === null ? null : state.apply(tr) };
}

const blockTexts = (doc: Node) => doc.content.content.map((child) => child.textContent);
const rects = [
  { top: 0, bottom: 100 },
  { top: 120, bottom: 200 },
];

describe("editor-block-drag: 최상위 블록을 임의의 블록 사이로 옮긴다", () => {
  it("WHEN 스티커 · 글꼴이 붙은 첫 블록을 moveTopBlockTo(0, 3) THEN 맨 끝으로 가고 attrs가 같으며 undo 한 번에 돌아온다", () => {
    const decorated = {
      font: "jua",
      stickers: [{ id: "heart", x: 10, y: 20, size: 15, rotate: 5 }],
    };
    const doc = docOf(paragraph("가나", decorated), paragraph("다라"), paragraph("마바"));
    const state = EditorState.create({ doc, plugins: [history()] });

    const { ok, next } = run(moveTopBlockTo(0, 3), state);

    expect(ok).toBe(true);
    expect(blockTexts(next!.doc)).toEqual(["다라", "마바", "가나"]);
    expect(next!.doc.child(2).attrs).toEqual(doc.child(0).attrs);
    expect(() => docFromNode(next!.doc)).not.toThrow();
    let undone: EditorState | null = null;
    undo(next!, (tr) => {
      undone = next!.apply(tr);
    });
    expect(undone!.doc.eq(doc)).toBe(true);
  });

  it("WHEN 커서가 C의 둘째 글자 앞이고 moveTopBlockTo(2, 0) THEN C · A · B이고 커서가 따라간다", () => {
    const doc = abc();
    const cursor = blockPos(doc, 2) + 1 + 1;
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, cursor) });

    const { ok, next } = run(moveTopBlockTo(2, 0), state);

    expect(ok).toBe(true);
    expect(blockTexts(next!.doc)).toEqual(["마바", "가나", "다라"]);
    expect(next!.selection.eq(TextSelection.create(next!.doc, 1 + 1))).toBe(true);
  });

  it.each([
    [1, 1],
    [1, 2],
  ])("WHEN 제자리 gap moveTopBlockTo(%i, %i) THEN false이고 dispatch하지 않는다", (from, gap) => {
    const state = EditorState.create({ doc: abc() });

    const { ok, next } = run(moveTopBlockTo(from, gap), state);

    expect(ok).toBe(false);
    expect(next).toBeNull();
  });

  it.each([
    [3, 0],
    [0, 4],
    [-1, 0],
  ])("WHEN 범위 밖 moveTopBlockTo(%i, %i) THEN false다", (from, gap) => {
    const state = EditorState.create({ doc: abc() });

    expect(run(moveTopBlockTo(from, gap), state).ok).toBe(false);
  });

  it("WHEN decorationMax에 blockGuard를 달고 첫 블록을 맨 끝으로 THEN 적용되고 docFromNode를 통과한다", () => {
    const doc = docToNode(schema, fixtures.decorationMax.doc);
    const state = EditorState.create({ doc, plugins: [blockGuard()] });
    const last = doc.childCount;

    const { ok, next } = run(moveTopBlockTo(0, last), state);

    expect(ok).toBe(true);
    expect(next!.doc.eq(doc)).toBe(false);
    expect(next!.doc.lastChild!.eq(doc.firstChild!)).toBe(true);
    expect(() => docFromNode(next!.doc)).not.toThrow();
  });
});

describe("editor-block-drag: 최상위 블록 뒤에 고른 종류의 새 블록을 넣는다", () => {
  it.each(Object.keys(INSERTABLE_BLOCKS) as InsertableBlockKind[])(
    "WHEN blockGuard를 단 A · B에서 insertBlockAfter(0, %s) THEN 둘째 블록이 그 종류이고 커서가 그 안이며 docFromNode를 통과한다",
    (kind) => {
      const doc = docOf(paragraph("가나"), paragraph("다라"));
      const state = EditorState.create({ doc, plugins: [blockGuard()] });

      const { ok, next } = run(insertBlockAfter(0, kind), state);

      expect(ok).toBe(true);
      const inserted = next!.doc.child(1);
      expect(inserted.type.name).toBe(INSERTABLE_BLOCKS[kind].type);
      const { $from } = next!.selection;
      const cursorBlock = $from.index(0);
      expect(cursorBlock).toBe(kind === "horizontalRule" ? 2 : 1);
      expect($from.parent.isTextblock).toBe(true);
      expect(() => docFromNode(next!.doc)).not.toThrow();
    },
  );

  it("WHEN A · B에서 insertBlockAfter(1, heading2) 뒤 undo THEN A · B로 돌아온다", () => {
    const doc = docOf(paragraph("가나"), paragraph("다라"));
    const state = EditorState.create({ doc, plugins: [history()] });

    const { next } = run(insertBlockAfter(1, "heading2"), state);
    let undone: EditorState | null = null;
    undo(next!, (tr) => {
      undone = next!.apply(tr);
    });

    expect(undone!.doc.eq(doc)).toBe(true);
  });

  it("WHEN 문단 A 하나에서 insertBlockAfter(0, horizontalRule) THEN A · 구분선 · 빈 문단이고 커서는 빈 문단 안이다", () => {
    const state = EditorState.create({ doc: docOf(paragraph("가나")) });

    const { next } = run(insertBlockAfter(0, "horizontalRule"), state);

    expect(next!.doc.content.content.map((child) => child.type.name)).toEqual([
      "paragraph",
      "horizontalRule",
      "paragraph",
    ]);
    expect(next!.selection.$from.index(0)).toBe(2);
  });

  // 타입이 막아도 UI · 저장된 설정에서 문자열이 올 수 있다 — 실행 중 거부도 지킨다
  it.each([
    [2, "paragraph"],
    [0, "image"],
  ])("WHEN insertBlockAfter(%i, %s) THEN false다", (index, kind) => {
    const state = EditorState.create({ doc: docOf(paragraph("가나"), paragraph("다라")) });

    expect(run(insertBlockAfter(index, kind as InsertableBlockKind), state).ok).toBe(false);
  });
});

describe("editor-block-drag: 포인터 y로 손잡이 블록과 놓일 자리를 고른다", () => {
  it("WHEN 블록 안 · 사이 여백 · 바깥 y THEN blockIndexAt은 가까운 블록이고 빈 배열이면 null이다", () => {
    expect([50, 105, 118, 300].map((y) => blockIndexAt(rects, y))).toEqual([0, 0, 1, 1]);
    expect(blockIndexAt([], 10)).toBeNull();
  });

  it("WHEN 블록 위 · 아래 절반 y THEN dropGapAt은 중앙 기준 앞뒤 gap이다", () => {
    expect([-10, 40, 60, 150, 170, 999].map((y) => dropGapAt(rects, y))).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
  });
});
