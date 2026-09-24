import type { Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import {
  createEditorSchema,
  docToNode,
  endMotionPreview,
  motionPreview,
  motionPreviewKey,
  previewMotion,
} from "../index";

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [{ type: "text", text: value }],
});

/** 둘째 문단(index 1)에 커서 — 첫 문단은 "가" 한 글자라 크기 3 */
function stateWithCursorInSecond(second: Json): EditorState {
  const node = docToNode(schema, { type: "doc", content: [paragraph("가"), second] });
  return EditorState.create({
    doc: node,
    selection: TextSelection.create(node, 4),
    plugins: [motionPreview()],
  });
}

function run(state: EditorState, command: Command): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

function previewRanges(state: EditorState): Array<{ from: number; to: number }> {
  const plugin = motionPreviewKey.get(state);
  const set = plugin?.props.decorations?.call(plugin, state) as DecorationSet | undefined;
  return (set?.find() ?? []).map(({ from, to }) => ({ from, to }));
}

const secondBlockRange = (doc: Node) => ({ from: 3, to: 3 + doc.child(1).nodeSize });

describe("움직임 미리 보기", () => {
  it("WHEN motion: pop 문단에서 previewMotion 뒤 endMotionPreview를 실행하면 THEN 첫 실행 뒤 그 문단에 장식이 있고 문서는 같으며 둘째 실행 뒤 장식이 없다", () => {
    const start = stateWithCursorInSecond(paragraph("나다", { motion: "pop" }));

    const previewing = run(start, previewMotion);
    expect(previewing.ok).toBe(true);
    expect(previewing.state.doc.eq(start.doc)).toBe(true);
    expect(previewRanges(previewing.state)).toEqual([secondBlockRange(start.doc)]);

    const ended = run(previewing.state, endMotionPreview);
    expect(ended.ok).toBe(true);
    expect(previewRanges(ended.state)).toEqual([]);
  });

  it("WHEN 움직임이 없는 문단에서 previewMotion을 실행하면 THEN false다", () => {
    const start = stateWithCursorInSecond(paragraph("나다"));

    expect(previewMotion(start)).toBe(false);
  });

  it("WHEN 미리 보기 중인 블록을 지우면 THEN 장식이 없다", () => {
    const start = stateWithCursorInSecond(paragraph("나다", { motion: "fade-in" }));
    const previewing = run(start, previewMotion).state;
    const { from, to } = secondBlockRange(start.doc);

    const deleted = previewing.apply(previewing.tr.delete(from, to));

    expect(previewRanges(deleted)).toEqual([]);
  });
});
