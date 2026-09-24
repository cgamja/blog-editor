import { history, undo } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { AllSelection, EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command, Selection } from "@tiptap/pm/state";
import type { Doc } from "@blog-editor/content-schema";
import {
  blockGuard,
  createEditorSchema,
  docFromNode,
  docToNode,
  wrapInBlockquote,
  wrapInBulletList,
  wrapInCallout,
  wrapInOrderedList,
} from "../index";

// ── 문서 · 상태 도구 (EditorState만 — DOM · EditorView 없음) ──

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const text = (value: string): Json => ({ type: "text", text: value });
const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [text(value)],
});
const heading = (value: string): Json => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(value)],
});
const callout = (tone: string, children: Json[], decoration: Json = {}): Json => ({
  type: "callout",
  attrs: { tone, ...decoration },
  content: children,
});
const image = (): Json => ({ type: "image", attrs: { src: "/images/a.webp", alt: "그림" } });
const doc = (...blocks: Json[]): Json => ({ type: "doc", content: blocks });

const heart = { id: "heart", x: 10, y: 20, size: 30, rotate: 0 };
const cloud = { id: "cloud", x: 40, y: 50, size: 30, rotate: 90 };

/** 최상위 블록 index 바로 앞 위치 */
function blockStart(node: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += node.child(i).nodeSize;
  return pos;
}

type Place = (node: Node) => Selection;

/** 최상위 블록 index의 첫 텍스트 자리(depth겹 안쪽) */
const at =
  (index: number, depth = 1): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, index) + depth);
/** 최상위 블록 from의 첫 글자부터 to의 첫 글자까지 */
const across =
  (from: number, to: number): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, from) + 1, blockStart(node, to) + 2);
const atDocEnd: Place = (node) => new GapCursor(node.resolve(node.content.size));
const all: Place = (node) => new AllSelection(node);

// 모든 상태에 blockGuard를 단다 — 결과가 가드를 통과해야 문서가 실제로 바뀐다
function stateAt(raw: Json, place: Place): EditorState {
  const node = docToNode(schema, raw);
  return EditorState.create({
    doc: node,
    selection: place(node),
    plugins: [blockGuard(), history()],
  });
}

interface CommandRun {
  ok: boolean;
  state: EditorState;
  /** 결과 문서를 저장 형식으로 — 저장할 수 없는 문서면 docFromNode가 던진다 */
  saved: Doc;
}

/** 실행하고, dispatch 없이 물은 답(can)이 실행 결과와 같은지도 확인한다 */
function run(state: EditorState, command: Command): CommandRun {
  const can = command(state);
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  expect(can).toBe(ok);
  return { ok, state: next, saved: docFromNode(next.doc) };
}

const top = (saved: Doc, index = 0) =>
  saved.content[index] as Json & { attrs?: Json; content?: Json[] };

// ── 시나리오 ──

describe("editor-wrap: 감싸면 꾸미기가 바깥 블록으로 옮겨진다", () => {
  it("WHEN blockGuard를 단 에디터에서 font · 스티커가 붙은 최상위 문단에 wrapInBlockquote THEN 인용이 꾸미기를 갖고 안쪽 문단에는 꾸미기가 없다", () => {
    const state = stateAt(doc(paragraph("가", { font: "jua", stickers: [heart] })), at(0));

    const result = run(state, wrapInBlockquote);

    expect(result.ok).toBe(true);
    expect(result.state.doc.eq(state.doc)).toBe(false);
    expect(result.saved.content).toEqual([
      {
        type: "blockquote",
        attrs: { font: "jua", stickers: [heart] },
        content: [{ type: "paragraph", content: [text("가")] }],
      },
    ]);
  });

  it.each([
    ["wrapInBulletList", wrapInBulletList, "bulletList"],
    ["wrapInOrderedList", wrapInOrderedList, "orderedList"],
  ] as const)(
    "WHEN 스티커가 붙은 문단 둘을 선택해 %s THEN 바깥 목록이 두 스티커를 순서대로 갖고 font는 값이 있는 첫 문단의 것이다",
    (_name, command, listType) => {
      const state = stateAt(
        doc(
          paragraph("가", { stickers: [heart] }),
          paragraph("나", { font: "gaegu", stickers: [cloud] }),
        ),
        across(0, 1),
      );

      const result = run(state, command);

      expect(result.ok).toBe(true);
      const list = top(result.saved);
      expect(list.type).toBe(listType);
      expect(list.attrs).toEqual({ font: "gaegu", stickers: [heart, cloud] });
      expect(JSON.stringify(list.content)).not.toContain("stickers");
    },
  );

  it("WHEN 꾸민 문단 하나에서 wrapInBulletList THEN 목록 항목 하나로 감싸이고 꾸미기가 바깥 목록으로 옮겨진다", () => {
    const state = stateAt(doc(paragraph("가", { font: "jua", stickers: [heart] })), at(0));

    const result = run(state, wrapInBulletList);

    expect(result.ok).toBe(true);
    expect(result.saved.content).toEqual([
      {
        type: "bulletList",
        attrs: { font: "jua", stickers: [heart] },
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("가")] }] }],
      },
    ]);
  });

  it("WHEN 문단 둘에 걸친 선택을 wrapInBulletList로 감싼다 THEN 선택이 같은 글자 위에 남는다", () => {
    const state = stateAt(doc(paragraph("가나"), paragraph("다라"), paragraph("마")), across(0, 1));
    const selected = state.doc.textBetween(state.selection.from, state.selection.to);

    const result = run(state, wrapInBulletList);

    expect(result.ok).toBe(true);
    const { from, to } = result.state.selection;
    expect(result.state.doc.textBetween(from, to)).toBe(selected);
  });

  it('WHEN motion이 붙은 최상위 문단에서 wrapInCallout("tip") THEN tone "tip" 콜아웃이 motion을 갖고 안쪽 문단에는 꾸미기가 없다', () => {
    const state = stateAt(doc(paragraph("가", { motion: "pop" })), at(0));

    const result = run(state, wrapInCallout("tip"));

    expect(result.ok).toBe(true);
    expect(result.saved.content).toEqual([
      {
        type: "callout",
        attrs: { tone: "tip", motion: "pop" },
        content: [{ type: "paragraph", content: [text("가")] }],
      },
    ]);
  });

  it("WHEN 콜아웃 안 문단에서 wrapInBulletList THEN 콜아웃 안에 목록이 생기고 콜아웃 꾸미기는 그대로 새 목록에는 꾸미기가 없다", () => {
    const state = stateAt(doc(callout("note", [paragraph("가")], { font: "jua" })), at(0, 2));

    const result = run(state, wrapInBulletList);

    expect(result.ok).toBe(true);
    const box = top(result.saved);
    expect(box.attrs).toEqual({ tone: "note", font: "jua" });
    expect(box.content).toEqual([
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("가")] }] }],
      },
    ]);
  });

  it("WHEN 꾸민 문단을 wrapInBlockquote로 감싼 뒤 undo 한 번 THEN 문서가 감싸기 전과 같다", () => {
    const state = stateAt(doc(paragraph("가", { font: "jua", stickers: [heart] })), at(0));
    const wrapped = run(state, wrapInBlockquote).state;

    let undone: EditorState | null = null;
    undo(wrapped, (tr) => {
      undone = wrapped.apply(tr);
    });

    expect(undone).not.toBeNull();
    expect(undone!.doc.eq(state.doc)).toBe(true);
  });

  it.each([
    ["제목을 wrapInBlockquote", doc(heading("제목")), at(0), wrapInBlockquote],
    [
      '콜아웃 안에서 wrapInCallout("tip")',
      doc(callout("note", [paragraph("가")])),
      at(0, 2),
      wrapInCallout("tip"),
    ],
    ['문단에서 wrapInCallout("bogus")', doc(paragraph("가")), at(0), wrapInCallout("bogus")],
    [
      "문서 끝 틈(gap cursor)에서 wrapInBlockquote",
      doc(paragraph("가"), image()),
      atDocEnd,
      wrapInBlockquote,
    ],
    [
      "제목이 섞인 전체 선택에서 wrapInBulletList",
      doc(paragraph("가"), heading("제목")),
      all,
      wrapInBulletList,
    ],
  ] as const)(
    "WHEN %s THEN false이고 dispatch 없이 물어도 false이며 문서가 그대로다",
    (_name, raw, place, command) => {
      const state = stateAt(raw, place);

      const result = run(state, command);

      expect(result.ok).toBe(false);
      expect(result.state.doc.eq(state.doc)).toBe(true);
    },
  );
});
