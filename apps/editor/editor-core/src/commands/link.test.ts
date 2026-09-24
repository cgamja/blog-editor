import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { createEditorSchema, docToNode } from "../index";
import { blockGuard } from "../plugins/block-guard";
import { removeLink, setLink } from "./link";

const schema = createEditorSchema();

function stateWith(content: object[], from: number, to = from): EditorState {
  const doc = docToNode(schema, { type: "doc", content: [{ type: "paragraph", content }] });
  const state = EditorState.create({ doc, plugins: [blockGuard()] });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, from, to)));
}

function run(command: Command, state: EditorState): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

const linkMarksOf = (state: EditorState) =>
  state.doc
    .child(0)
    .content.content.flatMap((node) => node.marks.filter((mark) => mark.type.name === "link"));

describe("editor-markdown-shortcuts: 링크는 허용 목록 주소로만", () => {
  it("WHEN 글자를 고르고 setLink(https 주소)를 부르면 THEN 그 글자에 그 href 링크가 있다", () => {
    const before = stateWith([{ type: "text", text: "앞글자" }], 2, 4);
    const { ok, state } = run(setLink("https://example.com"), before);

    expect(ok).toBe(true);
    const linked = state.doc.child(0).child(1);
    expect(linked.text).toBe("글자");
    expect(linked.marks.map((mark) => mark.attrs.href)).toEqual(["https://example.com"]);
  });

  it("WHEN 글자를 고르고 setLink(javascript:)를 부르면 THEN false이고 문서는 그대로다", () => {
    const before = stateWith([{ type: "text", text: "글자" }], 1, 3);
    const { ok, state } = run(setLink("javascript:alert(1)"), before);

    expect(ok).toBe(false);
    expect(state.doc.eq(before.doc)).toBe(true);
  });

  it("WHEN 링크 안에 커서를 두고 removeLink를 부르면 THEN 그 링크 글자 전체에 링크가 없다", () => {
    const link = { type: "link", attrs: { href: "https://example.com" } };
    const before = stateWith(
      [
        { type: "text", text: "앞" },
        { type: "text", text: "링크글자", marks: [link] },
      ],
      3,
    );
    const { ok, state } = run(removeLink, before);

    expect(ok).toBe(true);
    expect(linkMarksOf(state)).toEqual([]);
    expect(state.doc.child(0).textContent).toBe("앞링크글자");
  });
});
