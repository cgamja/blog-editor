import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { createEditorSchema, docToNode, selectBlock } from "../index";

const schema = createEditorSchema();

/** 문단 "가"(0–3) · 대체 텍스트가 빈 그림(3–4) · 문단 "나"(4–7) — 선택은 마지막 문단 끝 */
function start(): EditorState {
  const doc = docToNode(schema, {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "가" }] },
      {
        type: "image",
        attrs: { src: "/images/a.webp", alt: "", naturalWidth: 800, naturalHeight: 600 },
      },
      { type: "paragraph", content: [{ type: "text", text: "나" }] },
    ],
  });
  return EditorState.create({ doc, selection: TextSelection.create(doc, 6) });
}

function run(state: EditorState, command: Command): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

describe("selectBlock: 최상위 블록 번호(0부터)로 선택을 옮긴다", () => {
  it("WHEN [문단, 그림, 문단]에서 selectBlock(1) THEN 그림을 가리키는 NodeSelection이다", () => {
    const { ok, state } = run(start(), selectBlock(1));

    expect(ok).toBe(true);
    expect(state.selection).toBeInstanceOf(NodeSelection);
    expect((state.selection as NodeSelection).node.type.name).toBe("image");
  });

  it("WHEN [문단, 그림, 문단]에서 selectBlock(0) THEN 첫 문단 안의 TextSelection이다", () => {
    const { ok, state } = run(start(), selectBlock(0));

    expect(ok).toBe(true);
    expect(state.selection).toBeInstanceOf(TextSelection);
    expect(state.selection.$from.parent.textContent).toBe("가");
  });
});

/** 빈 문단(0) · 목록 [첫 항목, 둘째 항목](1) · 표 [첫 칸, 둘째 칸](2) · 문단 "끝"(3) — 선택은 마지막 문단 끝 */
function nested(): EditorState {
  const item = (text: string) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const cell = (text: string) => ({
    type: "tableCell",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const doc = docToNode(schema, {
    type: "doc",
    content: [
      { type: "paragraph" },
      { type: "bulletList", content: [item("첫 항목"), item("둘째 항목")] },
      { type: "table", content: [{ type: "tableRow", content: [cell("첫 칸"), cell("둘째 칸")] }] },
      { type: "paragraph", content: [{ type: "text", text: "끝" }] },
    ],
  });
  return EditorState.create({ doc, selection: TextSelection.atEnd(doc) });
}

describe("selectBlock: 글이 없거나 감싼 블록", () => {
  it("WHEN 빈 문단(블록 0)에서 selectBlock(0) THEN 그 빈 문단 안의 커서다", () => {
    const { ok, state } = run(nested(), selectBlock(0));

    expect(ok).toBe(true);
    expect(state.selection).toBeInstanceOf(TextSelection);
    expect(state.selection.empty).toBe(true);
    expect(state.selection.$from.index(0)).toBe(0);
    expect(state.selection.$from.parent.type.name).toBe("paragraph");
  });

  it("WHEN 목록(블록 1)에서 selectBlock(1) THEN 첫 항목의 글줄 안이다", () => {
    const { ok, state } = run(nested(), selectBlock(1));

    expect(ok).toBe(true);
    expect(state.selection).toBeInstanceOf(TextSelection);
    expect(state.selection.$from.index(0)).toBe(1);
    expect(state.selection.$from.parent.textContent).toBe("첫 항목");
  });

  it("WHEN 표(블록 2)에서 selectBlock(2) THEN 첫 칸의 글줄 안이다", () => {
    const { ok, state } = run(nested(), selectBlock(2));

    expect(ok).toBe(true);
    expect(state.selection).toBeInstanceOf(TextSelection);
    expect(state.selection.$from.index(0)).toBe(2);
    expect(state.selection.$from.parent.textContent).toBe("첫 칸");
  });

  it.each([
    ["-1", -1],
    ["childCount(4)", 4],
    ["1.5", 1.5],
  ])("WHEN 범위 밖 번호 %s THEN false이고 트랜잭션을 보내지 않는다", (_name, index) => {
    let dispatched = false;

    const ok = selectBlock(index)(nested(), () => {
      dispatched = true;
    });

    expect(ok).toBe(false);
    expect(dispatched).toBe(false);
  });
});
