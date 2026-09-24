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

describe("editor-list-keys: 빠져나온 문단 맨 앞 Backspace", () => {
  it("WHEN 목록 바로 뒤 문단 나 맨 앞에서 Backspace THEN 앞 목록 마지막 항목 끝에 글자가 합쳐진다", () => {
    const { ok, state } = press("Backspace", start([bullet([item("가")]), paragraph("나")], 1));

    expect(ok).toBe(true);
    expect(typesOf(state.doc)).toEqual(["bulletList"]);
    expect(state.doc.child(0).childCount).toBe(1);
    expect(state.doc.child(0).textContent).toBe("가나");
    expect(state.selection.$from.parentOffset).toBe(1);
  });

  it("WHEN 점 목록 가 · 나의 나 맨 앞에서 Backspace 두 번 THEN 한 항목 가나가 된다", () => {
    const once = press("Backspace", start([bullet([item("가"), item("나")])], 1));
    const twice = press("Backspace", once.state);

    expect(twice.ok).toBe(true);
    expect(typesOf(twice.state.doc)).toEqual(["bulletList"]);
    expect(twice.state.doc.child(0).childCount).toBe(1);
    expect(twice.state.doc.child(0).textContent).toBe("가나");
  });
});

describe("editor-list-keys: 최상위 목록의 꾸미기", () => {
  it("WHEN 같은 글꼴 목록이 앞에 또 있을 때 뒤 한 항목 목록 나 맨 앞에서 Backspace THEN 빠져나온 문단이 글꼴을 가진다", () => {
    const before = start(
      [
        bullet([item("가")], { font: "jua" }),
        paragraph("사이"),
        bullet([item("나")], { font: "jua" }),
      ],
      2,
    );
    const { ok, state } = press("Backspace", before);

    expect(ok).toBe(true);
    expect(typesOf(state.doc)).toEqual(["bulletList", "paragraph", "paragraph"]);
    expect(state.doc.child(2).attrs.font).toBe("jua");
    expect(state.doc.child(0).attrs.font).toBe("jua");
  });

  it("WHEN 같은 스티커 문단이 앞에 있을 때 스티커 목록 가운데 빈 항목에서 Enter THEN 앞 문단과 첫 목록 조각이 스티커를 가진다", () => {
    const before = start(
      [
        { ...paragraph("앞"), attrs: { stickers: [HEART] } },
        bullet([item("가"), item(), item("다")], { stickers: [HEART] }),
      ],
      2,
    );
    const { ok, state } = press("Enter", before);

    expect(ok).toBe(true);
    expect(typesOf(state.doc)).toEqual(["paragraph", "bulletList", "paragraph", "bulletList"]);
    expect(state.doc.child(0).attrs.stickers).toEqual([HEART]);
    expect(state.doc.child(1).attrs.stickers).toEqual([HEART]);
    expect(stickerCount(state.doc)).toBe(2);
  });

  it("WHEN 글꼴 · 움직임 · 스티커 목록 가운데 빈 항목에서 Enter THEN 글꼴은 두 조각 모두, 움직임 · 스티커는 앞 조각에만 남는다", () => {
    const attrs = { font: "jua", motion: "pop", stickers: [HEART] };
    const { state } = press("Enter", start([bullet([item("가"), item(), item("다")], attrs)], 1));

    const [first, , second] = state.doc.children;
    expect(first?.attrs).toMatchObject(attrs);
    expect(second?.attrs.font).toBe("jua");
    expect(second?.attrs.motion).toBeNull();
    expect(second?.attrs.stickers).toBeNull();
  });

  it("WHEN 스티커 12개 목록 가운데 빈 항목에서 Enter THEN 나뉘고 문서 스티커는 12개이며 저장 형식으로 읽힌다", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({ ...HEART, x: i * 5 }));
    const { ok, state } = press(
      "Enter",
      start([bullet([item("가"), item(), item("다")], { stickers: twelve })], 1),
    );

    expect(ok).toBe(true);
    expect(stickerCount(state.doc)).toBe(12);
    expect(() => docFromNode(state.doc)).not.toThrow();
  });

  it("WHEN 스티커 목록 첫 항목에서 Shift-Tab THEN 문단이 되고 남은 목록이 스티커를 그대로 가진다", () => {
    const { ok, state } = press(
      "Shift-Tab",
      start([bullet([item("가"), item("나")], { stickers: [HEART] })], 0),
    );

    expect(ok).toBe(true);
    expect(typesOf(state.doc)).toEqual(["paragraph", "bulletList"]);
    expect(state.doc.child(1).attrs.stickers).toEqual([HEART]);
    expect(stickerCount(state.doc)).toBe(1);
  });

  it("WHEN 안쪽 목록이 달린 한 항목 글꼴 목록 맨 앞에서 Backspace THEN 빠져나온 문단이 글꼴을 갖고 저장 형식으로 읽힌다", () => {
    const { ok, state } = press(
      "Backspace",
      start([bullet([item("가", bullet([item("나")]))], { font: "jua" })], 0),
    );

    expect(ok).toBe(true);
    expect(state.doc.child(0).type.name).toBe("paragraph");
    expect(state.doc.child(0).attrs.font).toBe("jua");
    expect(() => docFromNode(state.doc)).not.toThrow();
  });

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

describe("ordered-list-start: 번호 목록이 갈리면 뒤 조각이 번호를 잇는다", () => {
  const ordered = (items: object[], attrs?: Record<string, unknown>) => ({
    ...bullet(items, attrs),
    type: "orderedList",
  });
  const listsOf = (doc: Node) =>
    docFromNode(doc).content.map((block) => ({ type: block.type, attrs: block.attrs }));

  it("WHEN 가 · (빈 항목) · 나 · 다 번호 목록의 가운데 빈 항목에서 Enter THEN 번호 목록 가 · 문단 · start 3 번호 목록 나 · 다가 된다", () => {
    const { ok, state } = press(
      "Enter",
      start([ordered([item("가"), item(), item("나"), item("다")])], 1),
    );

    expect(ok).toBe(true);
    expect(listsOf(state.doc)).toEqual([
      { type: "orderedList", attrs: undefined },
      { type: "paragraph", attrs: undefined },
      { type: "orderedList", attrs: { start: 3 } },
    ]);
  });

  it("WHEN start 3 번호 목록 가 · 나 · 다의 나 맨 앞에서 Backspace THEN start 3 목록 가 · 문단 나 · start 5 목록 다가 된다", () => {
    const { ok, state } = press(
      "Backspace",
      start([ordered([item("가"), item("나"), item("다")], { start: 3 })], 1),
    );

    expect(ok).toBe(true);
    expect(listsOf(state.doc)).toEqual([
      { type: "orderedList", attrs: { start: 3 } },
      { type: "paragraph", attrs: undefined },
      { type: "orderedList", attrs: { start: 5 } },
    ]);
  });

  it("WHEN 번호 목록 가 · 나 · 다의 나에서 Shift-Tab THEN 목록 가 · 문단 나 · start 3 목록 다가 된다", () => {
    const { ok, state } = press(
      "Shift-Tab",
      start([ordered([item("가"), item("나"), item("다")])], 1),
    );

    expect(ok).toBe(true);
    expect(listsOf(state.doc)).toEqual([
      { type: "orderedList", attrs: undefined },
      { type: "paragraph", attrs: undefined },
      { type: "orderedList", attrs: { start: 3 } },
    ]);
  });

  it("WHEN 안쪽 번호 목록 가 · 나 · 다의 나에서 Shift-Tab THEN 나는 바깥 항목이 되고 그 아래 다 목록이 start 3이다", () => {
    const { ok, state } = press(
      "Shift-Tab",
      start([ordered([item("밖", ordered([item("가"), item("나"), item("다")]))])], 2),
    );

    expect(ok).toBe(true);
    expect(docFromNode(state.doc).content).toEqual([
      ordered([item("밖", ordered([item("가")])), item("나", ordered([item("다")], { start: 3 }))]),
    ]);
  });
});
