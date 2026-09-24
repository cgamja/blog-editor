import { Fragment, Slice } from "@tiptap/pm/model";
import type { Node } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { createEditorSchema, docFromNode, normalizePastedSlice, pasteNormalizer } from "../index";
import { el, hasRuleForTag, markFromStyle, readWith } from "../dom.test.helpers";

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

  it("WHEN 파싱 규칙에서 table · tr · td · th를 받는 규칙을 찾는다 THEN 없다", () => {
    expect(["table", "tr", "td", "th"].filter((tag) => hasRuleForTag(schema, tag))).toEqual([]);
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
