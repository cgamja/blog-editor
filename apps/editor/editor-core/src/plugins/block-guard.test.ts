import { Node } from "@tiptap/pm/model";
import type { Node as PmNode } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { FONTS, MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import { createEditorSchema, docFromNode, docToNode } from "../index";
import { blockGuard } from "./block-guard";

const schema = createEditorSchema();
const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value: string, attrs?: Record<string, unknown>) => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [text(value)],
});
const sticker = { id: "cloud", x: 125, y: 125, size: 50, rotate: 180 };
// 스펙 예시 값 — content-schema WIDTH_RANGE(25~100) 밖
const OUT_OF_RANGE_WIDTH = 10;

function stateOf(doc: PmNode): EditorState {
  return EditorState.create({ doc, plugins: [blockGuard()] });
}

/** 조건에 맞는 첫 노드의 위치 — 위치를 손으로 세지 않는다. */
function positionOf(doc: PmNode, match: (node: PmNode, parent: PmNode | null) => boolean): number {
  let found = -1;
  doc.descendants((node, pos, parent) => {
    if (found === -1 && match(node, parent)) found = pos;
    return found === -1;
  });
  if (found === -1) throw new Error("노드를 찾지 못했다");
  return found;
}

/** 조건에 맞는 첫 노드의 내용 끝 위치 — 텍스트를 이어 쓸 자리. */
function endOf(doc: PmNode, match: (node: PmNode, parent: PmNode | null) => boolean): number {
  const pos = positionOf(doc, match);
  return pos + doc.nodeAt(pos)!.nodeSize - 1;
}

const isFirstParagraph = (node: PmNode, parent: PmNode | null) =>
  node.type.name === "paragraph" && parent?.type.name === "doc";

function setAttr(state: EditorState, pos: number, key: string, value: unknown): EditorState {
  const node = state.doc.nodeAt(pos)!;
  return state.apply(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, [key]: value }));
}

const quoteDoc = {
  type: "doc",
  content: [
    paragraph("가"),
    { type: "blockquote", content: [paragraph("나")] },
    { type: "image", attrs: { src: "/images/a.webp", alt: "" } },
  ],
};

describe("editor-block-guard: 편집 중에도 문서는 닫힌 집합을 벗어나지 않는다", () => {
  it("WHEN 최상위 문단에 font를 설정한다 THEN 결과 문서의 그 문단에 font가 있다", () => {
    const state = stateOf(docToNode(schema, quoteDoc));
    const pos = positionOf(
      state.doc,
      (node, parent) => node.type.name === "paragraph" && parent === state.doc,
    );
    const next = setAttr(state, pos, "font", FONTS[1]);
    expect(next.doc.nodeAt(pos)!.attrs.font).toBe(FONTS[1]);
  });

  it("WHEN 인용 안 문단에 font를 설정한다 THEN 상태의 문서가 적용 전과 같다", () => {
    const state = stateOf(docToNode(schema, quoteDoc));
    const pos = positionOf(
      state.doc,
      (node, parent) => node.type.name === "paragraph" && parent?.type.name === "blockquote",
    );
    expect(setAttr(state, pos, "font", FONTS[1]).doc.eq(state.doc)).toBe(true);
  });

  it("WHEN 스티커가 상한만큼인 문서에서 다른 블록에 스티커를 더한다 THEN 상태의 문서가 적용 전과 같다", () => {
    const full = Array.from({ length: MAX_STICKERS_PER_DOC }, (_, i) =>
      paragraph(`${i}`, { stickers: [sticker] }),
    );
    const state = stateOf(docToNode(schema, { type: "doc", content: [...full, paragraph("끝")] }));
    const pos = positionOf(
      state.doc,
      (node) => node.type.name === "paragraph" && node.textContent === "끝",
    );
    expect(setAttr(state, pos, "stickers", [sticker]).doc.eq(state.doc)).toBe(true);
  });

  it("WHEN 이미지 width를 범위 밖으로 설정한다 THEN 상태의 문서가 적용 전과 같다", () => {
    const state = stateOf(docToNode(schema, quoteDoc));
    const pos = positionOf(state.doc, (node) => node.type.name === "image");
    expect(setAttr(state, pos, "width", OUT_OF_RANGE_WIDTH).doc.eq(state.doc)).toBe(true);
  });
});

describe("editor-block-guard: 조합 입력을 막지 않고 에디터를 얼리지 않는다", () => {
  it("WHEN 조합 입력(composition meta) 텍스트를 삽입한다 THEN 위반을 만들 수 없어 그대로 적용된다(면제가 아니다)", () => {
    const state = stateOf(docToNode(schema, quoteDoc));
    const at = endOf(state.doc, isFirstParagraph);
    const tr = state.tr.insertText("한", at).setMeta("composition", 1);
    expect(state.apply(tr).doc.firstChild!.textContent).toBe("가한");
  });

  it("WHEN 블록 경계를 넘는 선택을 조합 입력으로 바꾼다 THEN 결과 상태의 문서는 닫힌 집합 안이다", () => {
    const state = stateOf(docToNode(schema, quoteDoc));
    const from = endOf(state.doc, isFirstParagraph) - 1;
    const to = endOf(
      state.doc,
      (node, parent) => node.type.name === "paragraph" && parent?.type.name === "blockquote",
    );
    const next = state.apply(state.tr.insertText("한", from, to).setMeta("composition", 1));
    expect(() => docFromNode(next.doc)).not.toThrow();
  });

  it("WHEN 안쪽 문단에 꾸미기가 있는 상태에서 텍스트를 삽입한다 THEN 결과 문서에 그 텍스트가 있다", () => {
    const broken = {
      type: "doc",
      content: [
        paragraph("가"),
        { type: "blockquote", content: [paragraph("나", { font: FONTS[1] })] },
      ],
    };
    const state = stateOf(Node.fromJSON(schema, broken));
    expect(
      state.apply(state.tr.insertText("다", endOf(state.doc, isFirstParagraph))).doc.firstChild!
        .textContent,
    ).toBe("가다");
  });
});
