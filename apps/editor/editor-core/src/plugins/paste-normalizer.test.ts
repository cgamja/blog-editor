import { DOMParser, Fragment, Slice } from "@tiptap/pm/model";
import type { Node } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { createEditorSchema, docFromNode, normalizePastedSlice, pasteNormalizer } from "../index";
import { el, markFromStyle, miniDomFromSpecs, readWith } from "../dom.test.helpers";

const schema = createEditorSchema();
const paragraph = schema.nodes.paragraph!;
const blockquote = schema.nodes.blockquote!;
const image = schema.nodes.image!;
const sticker = { id: "heart", x: 50, y: 30, size: 20, rotate: 0 };

function sliceOf(...nodes: Node[]): Slice {
  return new Slice(Fragment.fromArray(nodes), 0, 0);
}

/** 문서를 만들고 커서를 `cursorIn`(문서 안 위치)에 둔 상태. */
function stateWith(blocks: Node[], cursorIn: number): EditorState {
  const doc = schema.nodes.doc!.create(null, blocks);
  const state = EditorState.create({ schema, doc });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, cursorIn)));
}

describe("editor-paste: 붙여넣은 HTML은 닫힌 집합으로만 읽힌다", () => {
  it("WHEN 구글 독스의 감싸는 b와 font-weight 700 span을 굵게 규칙으로 읽는다 THEN 앞의 것은 굵게가 아니고 뒤의 것은 굵게다", () => {
    const docsWrapper = el({
      tag: "b",
      attrs: { style: "font-weight:normal;", id: "docs-internal-guid-1" },
      children: ["가"],
    });

    expect(readWith(schema, "marks", "bold", docsWrapper)).toBe(false);
    expect(markFromStyle(schema, "bold", "font-weight", "700")).toBe(true);
  });

  it("WHEN javascript: 링크 · 절대 URL 이미지 · data: 이미지를 읽는다 THEN 링크 규칙과 이미지 규칙이 모두 거부한다", () => {
    const link = el({ tag: "a", attrs: { href: "javascript:alert(1)" }, children: ["가"] });
    const absolute = el({ tag: "img", attrs: { src: "https://example.com/a.png", alt: "" } });
    const inline = el({ tag: "img", attrs: { src: "data:image/png;base64,AA", alt: "" } });

    expect(readWith(schema, "marks", "link", link)).toBe(false);
    expect(readWith(schema, "nodes", "image", absolute)).toBe(false);
    expect(readWith(schema, "nodes", "image", inline)).toBe(false);
  });

  it("WHEN 머리 칸 · 본문 칸 모두 data-align=center인 표 HTML을 읽어 최상위 자리로 정규화해 빈 문단에 붙인다 THEN 2행 1열 표가 생기고 첫 행 칸만 center이며 docFromNode를 통과한다", () => {
    const html = miniDomFromSpecs([
      [
        "table",
        ["thead", ["tr", ["th", { "data-align": "center" }, "가"]]],
        ["tbody", ["tr", ["td", { "data-align": "center" }, "나"]]],
      ],
    ]);
    const slice = DOMParser.fromSchema(schema).parseSlice(
      // 가짜 DOM은 파서가 읽는 표면만 가졌다(dom.test.helpers MiniNode) — 파서의 DOM 타입으로 단언한다
      html as unknown as Parameters<DOMParser["parseSlice"]>[0],
    );
    const normalized = normalizePastedSlice(slice, { intoTopLevel: true });
    const state = stateWith([paragraph.create()], 1);
    const saved = docFromNode(state.apply(state.tr.replaceSelection(normalized)).doc);

    const cell = (text: string, align?: string) => ({
      type: "tableCell",
      ...(align === undefined ? {} : { attrs: { align } }),
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    expect(saved.content.find((block) => block.type === "table")).toEqual({
      type: "table",
      content: [
        { type: "tableRow", content: [cell("가", "center")] },
        { type: "tableRow", content: [cell("나")] },
      ],
    });
  });

  it("WHEN h1 · h2 · h3 · h4 · h6을 읽는다 THEN 수준이 차례로 2 · 2 · 3 · 3 · 3이다", () => {
    const levels = ["h1", "h2", "h3", "h4", "h6"].map((tag) => {
      const read = readWith(schema, "nodes", "heading", el({ tag, children: ["가"] }));
      return read === false ? false : read.level;
    });

    expect(levels).toEqual([2, 2, 3, 3, 3]);
  });
});

describe("editor-paste: 붙여넣은 조각은 넣을 자리에 맞게 정규화된다", () => {
  it("WHEN 꾸밈 · 스티커 문단 둘을 인용 안에 붙인다 THEN 꾸밈 · 스티커가 없고 결과 문서가 저장 가능하다", () => {
    const decorated = { font: "jua", motion: "pop", stickers: [sticker] };
    const pasted = sliceOf(
      paragraph.create(decorated, schema.text("가")),
      paragraph.create(decorated, schema.text("나")),
    );
    const state = stateWith(
      [blockquote.create(null, paragraph.create(null, schema.text("인용")))],
      3,
    );
    const plugin = pasteNormalizer();
    const view = { state } as EditorView;

    const normalized = plugin.props.transformPasted!.call(plugin, pasted, view, false);
    const result = state.apply(state.tr.replaceSelection(normalized)).doc;

    normalized.content.forEach((node) => {
      expect(node.attrs).toMatchObject({ font: null, motion: null, stickers: null });
    });
    expect(() => docFromNode(result)).not.toThrow();
  });

  it("WHEN 최상위 문단과 꾸밈 있는 인용 안 문단을 최상위에 붙인다 THEN 최상위 꾸밈만 남고 스티커는 사라지며 저장 가능하다", () => {
    const pasted = sliceOf(
      paragraph.create({ font: "jua", motion: "pop", stickers: [sticker] }, schema.text("가")),
      blockquote.create(null, paragraph.create({ font: "gaegu" }, schema.text("나"))),
    );
    const state = stateWith([paragraph.create(null, schema.text("본문"))], 3);

    const normalized = normalizePastedSlice(pasted, { intoTopLevel: true });
    const result = state.apply(state.tr.replaceSelection(normalized)).doc;

    expect(normalized.content.child(0).attrs).toMatchObject({
      font: "jua",
      motion: "pop",
      stickers: null,
    });
    expect(normalized.content.child(1).child(0).attrs).toMatchObject({ font: null });
    expect(() => docFromNode(result)).not.toThrow();
  });

  it("WHEN javascript: 링크 글자 · 절대 URL 이미지 · 원본 크기가 한쪽만 있는 이미지를 정규화한다 THEN 글자만 남고 외부 이미지는 없으며 남은 이미지에 원본 크기가 없다", () => {
    const badLink = schema.marks.link!.create({ href: "javascript:alert(1)" });
    const pasted = sliceOf(
      paragraph.create(null, schema.text("링크", [badLink])),
      image.create({ src: "https://example.com/a.png", alt: "" }),
      image.create({ src: "/images/b.webp", alt: "", naturalWidth: 100 }),
    );

    const normalized = normalizePastedSlice(pasted, { intoTopLevel: true });

    expect(normalized.content.childCount).toBe(2);
    expect(normalized.content.child(0).textContent).toBe("링크");
    expect(normalized.content.child(0).child(0).marks).toEqual([]);
    expect(normalized.content.child(1).attrs).toMatchObject({
      src: "/images/b.webp",
      naturalWidth: null,
      naturalHeight: null,
    });
  });

  it("WHEN 인용 안 문단을 노드 선택한 채 꾸밈 있는 문단을 붙인다 THEN 붙은 문단에 꾸밈이 없다", () => {
    const doc = schema.nodes.doc!.create(null, [
      blockquote.create(null, paragraph.create(null, schema.text("인용"))),
    ]);
    const start = EditorState.create({ schema, doc });
    // 인용(0) 안의 문단은 위치 1에서 시작한다
    const state = start.apply(start.tr.setSelection(NodeSelection.create(doc, 1)));
    const plugin = pasteNormalizer();

    const normalized = plugin.props.transformPasted!.call(
      plugin,
      sliceOf(paragraph.create({ font: "jua", motion: "pop" }, schema.text("가"))),
      { state } as EditorView,
      false,
    );

    expect(normalized.content.child(0).attrs).toMatchObject({ font: null, motion: null });
  });

  it("WHEN 에디터 안에서 끌어 옮기는 조각이 플러그인을 지난다 THEN 조각이 그대로이고 스티커가 남는다", () => {
    const dragged = sliceOf(paragraph.create({ stickers: [sticker] }, schema.text("가")));
    const state = stateWith([paragraph.create(null, schema.text("본문"))], 3);
    const plugin = pasteNormalizer();
    const view = { state, dragging: { slice: dragged, move: true } } as unknown as EditorView;

    const result = plugin.props.transformPasted!.call(plugin, dragged, view, false);

    expect(result).toBe(dragged);
    expect(result.content.child(0).attrs.stickers).toEqual([sticker]);
  });
});

describe("editor-paste: 표 조각은 붙일 자리에 맞게 정규화된다", () => {
  const cellNode = (text: string, align: string | null = null) =>
    schema.nodes.tableCell!.create({ align }, paragraph.create(null, schema.text(text)));
  const rowNode = (...cells: Node[]) => schema.nodes.tableRow!.create(null, cells);
  const tableNode = (...rows: Node[]) => schema.nodes.table!.create(null, rows);

  /** 표 하나 — 커서는 둘째 행 첫 칸 글자 끝 */
  function stateInCell(): EditorState {
    const doc = schema.nodes.doc!.create(null, [
      tableNode(rowNode(cellNode("머리")), rowNode(cellNode("본문"))),
    ]);
    const state = EditorState.create({ schema, doc });
    let at = 0;
    doc.descendants((node, pos) => {
      if (node.isText && node.text === "본문") at = pos + node.nodeSize;
    });
    return state.apply(state.tr.setSelection(TextSelection.create(doc, at)));
  }

  it("WHEN 머리 칸에 정렬이 있는 행 조각을 칸 자리로 정규화한다 THEN 모든 칸의 정렬이 지워진다", () => {
    const slice = new Slice(
      Fragment.fromArray([rowNode(cellNode("가", "right")), rowNode(cellNode("나"))]),
      1,
      1,
    );
    const normalized = normalizePastedSlice(slice, { intoTopLevel: false, intoTableCell: true });

    const aligns: unknown[] = [];
    normalized.content.descendants((node) => {
      if (node.type.name === "tableCell") aligns.push(node.attrs.align);
    });
    expect(aligns).toEqual([null, null]);
  });

  it("WHEN 병합 칸이 있어 행 길이가 다른 표 HTML을 최상위로 정규화해 붙인다 THEN 짧은 행에 빈 칸이 채워져 docFromNode를 통과한다", () => {
    const html = miniDomFromSpecs([
      ["table", ["tr", ["td", { colspan: "2" }, "합친 칸"]], ["tr", ["td", "가"], ["td", "나"]]],
    ]);
    const slice = DOMParser.fromSchema(schema).parseSlice(
      html as unknown as Parameters<DOMParser["parseSlice"]>[0],
    );
    const normalized = normalizePastedSlice(slice, { intoTopLevel: true });
    const state = stateWith([paragraph.create()], 1);
    const saved = docFromNode(state.apply(state.tr.replaceSelection(normalized)).doc);

    const table = saved.content.find((block) => block.type === "table");
    expect(table?.type === "table" && table.content.map((row) => row.content.length)).toEqual([
      2, 2,
    ]);
  });

  it("WHEN 문단 둘 조각을 칸 자리로 정규화해 칸에 붙인다 THEN 칸 글자가 공백 하나로 이어지고 docFromNode를 통과한다", () => {
    const slice = sliceOf(
      paragraph.create(null, schema.text("가")),
      paragraph.create(null, schema.text("나")),
    );
    const normalized = normalizePastedSlice(slice, { intoTopLevel: false, intoTableCell: true });
    const state = stateInCell();
    const doc = state.apply(state.tr.replaceSelection(normalized)).doc;

    const saved = docFromNode(doc);
    const table = saved.content[0];
    expect(table?.type === "table" && table.content[1]?.content[0]?.content[0].content).toEqual([
      { type: "text", text: "본문가 나" },
    ]);
  });
});
