import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { redo, undo } from "@tiptap/pm/history";
import { createEditorSchema, docToNode } from "../index";
import { insertCallout } from "../commands/custom-blocks";
import { moveBlockUp } from "../commands/move-block";
import { blockGuard } from "./block-guard";
import { historyKeymap, historyPlugins } from "./history";

const schema = createEditorSchema();

const paragraph = (value: string) => ({
  type: "paragraph",
  content: [{ type: "text", text: value }],
});

/** 에디터가 싣는 것처럼 history와 blockGuard를 단 상태 — 커서는 둘째 문단 안. */
function stateWithHistory(): EditorState {
  const doc = docToNode(schema, { type: "doc", content: [paragraph("첫"), paragraph("둘")] });
  const state = EditorState.create({ doc, plugins: [...historyPlugins(), blockGuard()] });
  const insideSecond = doc.child(0).nodeSize + 2;
  return state.apply(state.tr.setSelection(TextSelection.create(doc, insideSecond)));
}

function apply(command: Command, state: EditorState): EditorState {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  expect(ok).toBe(true);
  return next;
}

describe("editor-history: 에디터에서 되돌리기 · 다시 하기", () => {
  it("WHEN historyKeymap을 보면 THEN Mod-z는 undo, Mod-Shift-z · Mod-y는 redo다", () => {
    expect(historyKeymap).toEqual({ "Mod-z": undo, "Mod-Shift-z": redo, "Mod-y": redo });
  });

  it("WHEN historyPlugins를 단 상태에서 콜아웃을 넣고 undo 한 번 THEN 넣기 전 문서다", () => {
    const before = stateWithHistory();
    const inserted = apply(insertCallout("tip"), before);
    expect(inserted.doc.eq(before.doc)).toBe(false);

    const undone = apply(undo, inserted);

    expect(undone.doc.eq(before.doc)).toBe(true);
  });

  it("WHEN historyPlugins를 단 상태에서 블록을 위로 옮기고 undo 한 번 THEN 옮기기 전 문서다", () => {
    const before = stateWithHistory();
    const moved = apply(moveBlockUp, before);
    expect(moved.doc.child(0).textContent).toBe("둘");

    const undone = apply(undo, moved);

    expect(undone.doc.eq(before.doc)).toBe(true);
  });
});
