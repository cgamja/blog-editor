import { history, undo } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { AllSelection, EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command, Selection } from "@tiptap/pm/state";
import type { Doc } from "@blog-editor/content-schema";
import {
  alignKeymap,
  alignOf,
  blockGuard,
  createEditorSchema,
  docFromNode,
  docToNode,
  setBlockAlign,
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
const heading = (value: string, attrs: Json = {}): Json => ({
  type: "heading",
  attrs: { level: 2, ...attrs },
  content: [text(value)],
});
const codeBlock = (value: string): Json => ({ type: "codeBlock", content: [text(value)] });
const bulletList = (value: string): Json => ({
  type: "bulletList",
  content: [{ type: "listItem", content: [paragraph(value)] }],
});
const image = (attrs: Json = {}): Json => ({
  type: "image",
  attrs: { src: "/images/a.webp", alt: "그림", ...attrs },
});
const doc = (...blocks: Json[]): Json => ({ type: "doc", content: blocks });

/** 최상위 블록 index 바로 앞 위치 */
function blockStart(node: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += node.child(i).nodeSize;
  return pos;
}

type Place = (node: Node) => Selection;

const at =
  (index: number, depth = 1): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, index) + depth);
/** 최상위 블록 from의 첫 글자부터 to 블록 끝까지 */
const across =
  (from: number, to: number): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, from) + 1, blockStart(node, to + 1));
const nodeAt =
  (index: number): Place =>
  (node) =>
    NodeSelection.create(node, blockStart(node, index));
const atDocEnd: Place = (node) => new GapCursor(node.resolve(node.content.size));
const all: Place = (node) => new AllSelection(node);

// 모든 상태에 blockGuard를 단다 — 결과가 가드를 통과해야 문서가 실제로 바뀐다
function stateAt(raw: Json, place: Place = at(0)): EditorState {
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

const attrsOf = (saved: Doc, index: number) =>
  (saved.content[index] as { attrs?: Json }).attrs ?? {};

// ── 시나리오 ──

describe("editor-align: 블록 정렬을 바꾼다", () => {
  it("WHEN 문단에 커서를 두고 setBlockAlign('center') THEN 그 문단의 align이 center다", () => {
    const result = run(stateAt(doc(paragraph("가"), paragraph("나"))), setBlockAlign("center"));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({ align: "center" });
    expect(attrsOf(result.saved, 1)).toEqual({});
  });

  it("WHEN 가운데 정렬 문단에 setBlockAlign('left') THEN 그 문단에 align이 없다", () => {
    const result = run(stateAt(doc(paragraph("가", { align: "center" }))), setBlockAlign("left"));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({});
  });

  it("WHEN 문단과 그림에 걸친 선택에서 setBlockAlign('left') THEN 문단에는 align이 없고 그림의 align은 left다", () => {
    const state = stateAt(doc(paragraph("가", { align: "right" }), image()), across(0, 1));

    const result = run(state, setBlockAlign("left"));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({});
    expect(attrsOf(result.saved, 1)).toMatchObject({ align: "left" });
  });

  it.each([
    ["align 없는 그림에 center", stateAt(doc(image()), nodeAt(0)), "center"],
    ["align 없는 문단에 left", stateAt(doc(paragraph("가"))), "left"],
    ["right 제목에 right", stateAt(doc(heading("가", { align: "right" }))), "right"],
  ] as const)(
    "WHEN 이미 그 모양인 %s THEN true이지만 dispatch하지 않는다",
    (_name, state, align) => {
      let dispatched = 0;
      const ok = setBlockAlign(align)(state, () => {
        dispatched += 1;
      });

      expect(setBlockAlign(align)(state)).toBe(true);
      expect(ok).toBe(true);
      expect(dispatched).toBe(0);
    },
  );

  it.each([
    ["목록", stateAt(doc(bulletList("가")), at(0, 3)), "center"],
    ["코드 블록", stateAt(doc(codeBlock("x"))), "center"],
    [
      "문단과 목록에 걸친 선택",
      stateAt(doc(paragraph("가"), bulletList("나")), across(0, 1)),
      "right",
    ],
    ["집합 밖 값", stateAt(doc(paragraph("가"))), "justify"],
    ["GapCursor", stateAt(doc(image()), atDocEnd), "center"],
    ["전체 선택", stateAt(doc(paragraph("가")), all), "center"],
  ] as const)("WHEN %s에서 setBlockAlign THEN false이고 문서가 그대로다", (_name, state, align) => {
    const result = run(state, setBlockAlign(align));

    expect(result.ok).toBe(false);
    expect(result.state.doc.eq(state.doc)).toBe(true);
  });

  it("WHEN 문단을 오른쪽 정렬한 뒤 undo 한 번 THEN 문서가 정렬 전과 같다", () => {
    const state = stateAt(doc(paragraph("가")));
    const aligned = run(state, setBlockAlign("right")).state;

    let undone = aligned;
    undo(aligned, (tr) => {
      undone = aligned.apply(tr);
    });

    expect(undone.doc.eq(state.doc)).toBe(true);
  });
});

describe("editor-align: 블록의 지금 정렬", () => {
  it("WHEN align 없는 문단 · align 없는 그림 · 오른쪽 정렬 제목 · 목록의 alignOf THEN left · center · right · null이다", () => {
    const node = docToNode(
      schema,
      doc(paragraph("가"), image(), heading("나", { align: "right" }), bulletList("다")),
    );

    expect([0, 1, 2, 3].map((index) => alignOf(node.child(index)))).toEqual([
      "left",
      "center",
      "right",
      null,
    ]);
  });
});

describe("editor-align: 정렬 단축키", () => {
  it("WHEN 문단에 커서를 두고 Mod-Shift-e 바인딩을 실행한다 THEN 그 문단의 align이 center다", () => {
    const result = run(stateAt(doc(paragraph("가"))), alignKeymap["Mod-Shift-e"]!);

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({ align: "center" });
  });

  it("WHEN 코드 블록에 커서를 두고 Mod-Shift-r 바인딩을 실행한다 THEN true이고 문서가 그대로다", () => {
    const state = stateAt(doc(codeBlock("x")));
    let next = state;

    const ok = alignKeymap["Mod-Shift-r"]!(state, (tr) => {
      next = state.apply(tr);
    });

    expect(ok).toBe(true);
    expect(next.doc.eq(state.doc)).toBe(true);
  });

  it("WHEN alignKeymap의 키를 보면 THEN ⌘⇧L · ⌘⇧E · ⌘⇧R 세 개다", () => {
    expect(Object.keys(alignKeymap).sort()).toEqual(["Mod-Shift-e", "Mod-Shift-l", "Mod-Shift-r"]);
  });
});
