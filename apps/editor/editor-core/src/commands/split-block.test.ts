import type { Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { createEditorSchema, docFromNode, splitBlockKeepingStickers } from "../index";

const schema = createEditorSchema();
const { paragraph, heading, codeBlock } = {
  paragraph: schema.nodes.paragraph!,
  heading: schema.nodes.heading!,
  codeBlock: schema.nodes.codeBlock!,
};
const sticker = { id: "heart", x: 50, y: 30, size: 20, rotate: 0 };

/** 블록 하나짜리 문서, 커서는 그 블록 안 `offset`. */
function stateAt(block: Node, offset: number): EditorState {
  const doc = schema.nodes.doc!.create(null, [block]);
  const state = EditorState.create({ schema, doc });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, 1 + offset)));
}

/** 커맨드를 부르고 dispatch된 결과 상태(없으면 null)를 돌려준다. */
function run(state: EditorState): { ok: boolean; next: EditorState | null } {
  let next: EditorState | null = null;
  const ok = splitBlockKeepingStickers(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, next };
}

describe("editor-schema: 블록을 나눠도 스티커는 한 블록에만 남는다", () => {
  it("WHEN 스티커 · 글꼴이 있는 최상위 문단 가운데에서 나눈다 THEN 스티커는 앞 블록에만 있고 글꼴은 양쪽에 있으며 저장 가능하다", () => {
    const { ok, next } = run(
      stateAt(paragraph.create({ font: "jua", stickers: [sticker] }, schema.text("가나")), 1),
    );

    const doc = next!.doc;
    expect(ok).toBe(true);
    expect(doc.childCount).toBe(2);
    expect(doc.child(0).attrs).toMatchObject({ font: "jua", stickers: [sticker] });
    expect(doc.child(1).attrs).toMatchObject({ font: "jua", stickers: null });
    expect(() => docFromNode(doc)).not.toThrow();
  });

  it.each([
    ["문단", paragraph.create({ stickers: [sticker] }, schema.text("가나"))],
    ["제목", heading.create({ level: 2, stickers: [sticker] }, schema.text("가나"))],
  ])(
    "WHEN 스티커가 있는 %s 맨 앞에서 나눈다 THEN 빈 앞 블록에는 없고 글이 남은 뒤 블록에 스티커가 있으며 저장 가능하다",
    (_name, block) => {
      const { ok, next } = run(stateAt(block, 0));

      const doc = next!.doc;
      expect(ok).toBe(true);
      expect(doc.child(0).textContent).toBe("");
      expect(doc.child(0).attrs.stickers ?? null).toBeNull();
      expect(doc.child(1).textContent).toBe("가나");
      expect(doc.child(1).attrs.stickers).toEqual([sticker]);
      expect(() => docFromNode(doc)).not.toThrow();
    },
  );

  it("WHEN 스티커가 있는 코드 블록 안에서 부른다 THEN false이고 dispatch하지 않는다", () => {
    const { ok, next } = run(
      stateAt(codeBlock.create({ stickers: [sticker] }, schema.text("ab")), 1),
    );

    expect(ok).toBe(false);
    expect(next).toBeNull();
  });
});
