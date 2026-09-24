import type { Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { createEditorSchema, docFromNode, docToNode, listKeymap, stickerCount } from "../index";
import { blockGuard } from "./block-guard";

const schema = createEditorSchema();

const HEART = { id: "heart", x: 50, y: 50, size: 10, rotate: 0 };

const paragraph = (text = "") => ({
  type: "paragraph",
  ...(text === "" ? {} : { content: [{ type: "text", text }] }),
});

const item = (text = "", nested?: object) => ({
  type: "listItem",
  content: [paragraph(text), ...(nested === undefined ? [] : [nested])],
});

const bullet = (items: object[], attrs?: Record<string, unknown>) => ({
  type: "bulletList",
  ...(attrs === undefined ? {} : { attrs }),
  content: items,
});

/** 문서 순서로 index번째 텍스트 블록의 첫 글자 자리 */
function textblockStart(doc: Node, index: number): number {
  const starts: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) starts.push(pos + 1);
  });
  const start = starts[index];
  if (start === undefined) throw new Error(`텍스트 블록 ${index}번이 없다`);
  return start;
}

/** blockGuard를 단 상태 — 커서는 index번째 텍스트 블록 맨 앞에서 offset만큼 */
function start(content: object[], index = 0, offset = 0): EditorState {
  const doc = docToNode(schema, { type: "doc", content });
  const state = EditorState.create({ doc, plugins: [blockGuard()] });
  const at = textblockStart(doc, index) + offset;
  return state.apply(state.tr.setSelection(TextSelection.create(doc, at)));
}

function press(key: string, state: EditorState): { ok: boolean; state: EditorState } {
  const command: Command | undefined = listKeymap[key];
  if (command === undefined) throw new Error(`${key} 키가 없다`);
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

const typesOf = (doc: Node) => doc.children.map((child) => child.type.name);

describe("editor-list-keys: Enter", () => {
  it("WHEN 점 목록 항목 가나의 가 뒤에서 Enter THEN 항목 가 · 나 두 개가 되고 커서는 둘째 항목 맨 앞이다", () => {
    const { ok, state } = press("Enter", start([bullet([item("가나")])], 0, 1));

    expect(ok).toBe(true);
    const list = state.doc.child(0);
    expect(list.childCount).toBe(2);
    expect(list.child(0).textContent).toBe("가");
    expect(list.child(1).textContent).toBe("나");
    expect(state.selection.$from.parent.textContent).toBe("나");
    expect(state.selection.$from.parentOffset).toBe(0);
  });

  it("WHEN 점 목록의 마지막 빈 항목에서 Enter THEN 목록 뒤에 빈 최상위 문단이 생기고 커서가 그 안에 있다", () => {
    const { ok, state } = press("Enter", start([bullet([item("가"), item()])], 1));

    expect(ok).toBe(true);
    expect(typesOf(state.doc)).toEqual(["bulletList", "paragraph"]);
    expect(state.doc.child(0).childCount).toBe(1);
    expect(state.doc.child(1).content.size).toBe(0);
    expect(state.selection.$from.depth).toBe(1);
  });

  it("WHEN 안쪽 목록의 빈 항목에서 Enter THEN 그 항목이 바깥 목록의 항목이 된다", () => {
    const { ok, state } = press("Enter", start([bullet([item("가", bullet([item()]))])], 1));

    expect(ok).toBe(true);
    const outer = state.doc.child(0);
    expect(outer.childCount).toBe(2);
    expect(outer.child(1).textContent).toBe("");
    expect(state.selection.$from.depth).toBe(3);
  });

  it("WHEN 최상위 문단에서 Enter를 listKeymap으로 부르면 THEN false다", () => {
    expect(press("Enter", start([paragraph("가")], 0, 1)).ok).toBe(false);
  });
});

describe("editor-list-keys: Tab · Shift-Tab", () => {
  it("WHEN 점 목록 둘째 항목에서 Tab THEN 첫 항목 안의 안쪽 점 목록 항목이 된다", () => {
    const { ok, state } = press("Tab", start([bullet([item("가"), item("나")])], 1));

    expect(ok).toBe(true);
    const outer = state.doc.child(0);
    expect(outer.childCount).toBe(1);
    const inner = outer.child(0).child(1);
    expect(inner.type.name).toBe("bulletList");
    expect(inner.child(0).textContent).toBe("나");
  });

  it("WHEN 점 목록 첫 항목에서 Tab THEN true이고 문서는 그대로다", () => {
    const before = start([bullet([item("가"), item("나")])], 0);
    const { ok, state } = press("Tab", before);

    expect(ok).toBe(true);
    expect(state.doc.eq(before.doc)).toBe(true);
  });

  it("WHEN 안쪽 목록 항목에서 Shift-Tab THEN 바깥 목록의 항목이 된다", () => {
    const { ok, state } = press(
      "Shift-Tab",
      start([bullet([item("가", bullet([item("나")]))])], 1),
    );

    expect(ok).toBe(true);
    const outer = state.doc.child(0);
    expect(outer.childCount).toBe(2);
    expect(outer.child(1).textContent).toBe("나");
  });

  it("WHEN 최상위 문단에서 Tab THEN false다", () => {
    expect(press("Tab", start([paragraph("가")])).ok).toBe(false);
  });
});

describe("editor-list-keys: Backspace", () => {
  it("WHEN 한 항목짜리 점 목록 가 맨 앞에서 Backspace THEN 최상위 문단 가가 된다", () => {
    const { ok, state } = press("Backspace", start([bullet([item("가")])]));

    expect(ok).toBe(true);
    expect(typesOf(state.doc)).toEqual(["paragraph"]);
    expect(state.doc.child(0).textContent).toBe("가");
  });

  it("WHEN 항목 가나의 가 뒤에서 Backspace THEN false다", () => {
    expect(press("Backspace", start([bullet([item("가나")])], 0, 1)).ok).toBe(false);
  });
});

describe("editor-list-keys: 최상위 목록의 꾸미기", () => {
  it("WHEN 스티커 1개가 붙은 세 항목 점 목록의 가운데 빈 항목에서 Enter THEN 목록 · 문단 · 목록이 되고 스티커는 1개이며 첫 목록에 있다", () => {
    const before = start([bullet([item("가"), item(), item("다")], { stickers: [HEART] })], 1);
    const { ok, state } = press("Enter", before);

    expect(ok).toBe(true);
    expect(typesOf(state.doc)).toEqual(["bulletList", "paragraph", "bulletList"]);
    expect(stickerCount(state.doc)).toBe(1);
    expect(state.doc.child(0).attrs.stickers).toEqual([HEART]);
    expect(() => docFromNode(state.doc)).not.toThrow();
  });

  it("WHEN font jua와 스티커 1개가 붙은 한 항목 점 목록 가 맨 앞에서 Backspace THEN 문단 가가 font jua와 스티커 1개를 가진다", () => {
    const before = start([bullet([item("가")], { font: "jua", stickers: [HEART] })]);
    const { ok, state } = press("Backspace", before);

    expect(ok).toBe(true);
    const block = state.doc.child(0);
    expect(block.type.name).toBe("paragraph");
    expect(block.attrs.font).toBe("jua");
    expect(block.attrs.stickers).toEqual([HEART]);
    expect(() => docFromNode(state.doc)).not.toThrow();
  });
});
