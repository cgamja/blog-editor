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
