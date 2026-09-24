import { AllSelection, EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { history, undo } from "@tiptap/pm/history";
import { fixtures } from "@blog-editor/content-schema";
import { createEditorSchema, docFromNode, docToNode } from "../index";
import { moveBlockDown, moveBlockKeymap, moveBlockUp } from "./move-block";

const schema = createEditorSchema();

const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value: string) => ({ type: "paragraph", content: [text(value)] });
const docOf = (...content: unknown[]) => docToNode(schema, { type: "doc", content });

/** 최상위 i번째 블록이 시작하는 위치(블록 바로 앞). */
function blockPos(doc: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return pos;
}

/** 커맨드를 부르고 결과 상태를 돌려준다 — dispatch가 불리지 않으면 null. */
function run(
  command: typeof moveBlockUp,
  state: EditorState,
): { ok: boolean; next: EditorState | null } {
  let tr: Transaction | null = null;
  const ok = command(state, (t) => {
    tr = t;
  });
  return { ok, next: tr === null ? null : state.apply(tr) };
}

const blockTypes = (doc: Node) => doc.content.content.map((child) => child.type.name);
const blockTexts = (doc: Node) => doc.content.content.map((child) => child.textContent);

describe("editor-move-block: 최상위 블록을 이웃 블록과 자리 바꾼다", () => {
  it("WHEN 인용 안 문단 셋째 글자 앞 커서로 moveBlockUp THEN 인용이 통째로 올라가고 커서는 같은 글자 앞이다", () => {
    const doc = docOf(paragraph("위 문단"), {
      type: "blockquote",
      content: [paragraph("인용 문단")],
    });
    // 인용 시작 + 인용 여는 자리 1 + 문단 여는 자리 1 + 글자 2개
    const cursor = blockPos(doc, 1) + 2 + 2;
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, cursor) });

    const { ok, next } = run(moveBlockUp, state);

    expect(ok).toBe(true);
    expect(blockTypes(next!.doc)).toEqual(["blockquote", "paragraph"]);
    const moved = blockPos(next!.doc, 0) + 2 + 2;
    expect(next!.selection.eq(TextSelection.create(next!.doc, moved))).toBe(true);
    expect(() => docFromNode(next!.doc)).not.toThrow();
  });

  it("WHEN 이미지를 노드 선택하고 moveBlockDown THEN 문단 · 이미지 순서이고 선택은 옮긴 이미지다", () => {
    const doc = docOf(
      { type: "image", attrs: { src: "/images/a.webp", alt: "그림" } },
      paragraph("아래"),
    );
    const state = EditorState.create({ doc, selection: NodeSelection.create(doc, 0) });

    const { ok, next } = run(moveBlockDown, state);

    expect(ok).toBe(true);
    expect(blockTypes(next!.doc)).toEqual(["paragraph", "image"]);
    const selection = next!.selection;
    expect(selection).toBeInstanceOf(NodeSelection);
    expect(selection.from).toBe(blockPos(next!.doc, 1));
    expect(() => docFromNode(next!.doc)).not.toThrow();
  });

  it("WHEN B 안에서 C 안까지 걸친 선택으로 moveBlockUp THEN B · C · A이고 선택 양 끝은 같은 글자 위치다", () => {
    const doc = docOf(paragraph("AAA"), paragraph("BBB"), paragraph("CCC"));
    const anchor = blockPos(doc, 1) + 1 + 1;
    const head = blockPos(doc, 2) + 1 + 2;
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, anchor, head) });

    const { ok, next } = run(moveBlockUp, state);

    expect(ok).toBe(true);
    expect(blockTexts(next!.doc)).toEqual(["BBB", "CCC", "AAA"]);
    const expected = TextSelection.create(
      next!.doc,
      blockPos(next!.doc, 0) + 1 + 1,
      blockPos(next!.doc, 1) + 1 + 2,
    );
    expect(next!.selection.eq(expected)).toBe(true);
  });

  it("WHEN 가운데 블록을 노드 선택하고 moveBlockUp THEN 그 블록이 첫째가 되고 선택이 따라간다", () => {
    const doc = docOf(
      paragraph("AAA"),
      { type: "image", attrs: { src: "/images/a.webp", alt: "그림" } },
      paragraph("CCC"),
    );
    const state = EditorState.create({
      doc,
      selection: NodeSelection.create(doc, blockPos(doc, 1)),
    });

    const { ok, next } = run(moveBlockUp, state);

    expect(ok).toBe(true);
    expect(blockTypes(next!.doc)).toEqual(["image", "paragraph", "paragraph"]);
    expect(next!.selection).toBeInstanceOf(NodeSelection);
    expect(next!.selection.from).toBe(0);
  });

  it("WHEN 드래그 끝이 다음 블록 맨 앞에 걸친 선택으로 moveBlockUp THEN 그 블록은 옮기지 않는다", () => {
    const doc = docOf(paragraph("AAA"), paragraph("BBB"), paragraph("CCC"));
    const anchor = blockPos(doc, 1) + 1 + 1;
    const head = blockPos(doc, 2) + 1;
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, anchor, head) });

    const { ok, next } = run(moveBlockUp, state);

    expect(ok).toBe(true);
    expect(blockTexts(next!.doc)).toEqual(["BBB", "AAA", "CCC"]);
    expect(next!.selection.from).toBe(blockPos(next!.doc, 0) + 1 + 1);
  });

  it.each([
    ["문서 끝 gap에서 moveBlockUp", moveBlockUp, "end", ["BBB", "AAA"]],
    ["문서 앞 gap에서 moveBlockDown", moveBlockDown, "start", ["AAA", "BBB"]],
  ] as const)(
    "WHEN %s THEN gap에 붙은 블록이 옮겨지고 gap이 그 블록을 따라간다",
    (_name, command, where, order) => {
      // gap은 양쪽이 닫힌 블록(이미지)일 때만 유효하다 — 옮긴 뒤에도 gap이 남도록 둘 다 이미지로 둔다
      const image = (alt: string) => ({ type: "image", attrs: { src: "/images/a.webp", alt } });
      const doc =
        where === "end" ? docOf(image("AAA"), image("BBB")) : docOf(image("BBB"), image("AAA"));
      const gapPos = where === "end" ? doc.content.size : 0;
      const state = EditorState.create({ doc, selection: new GapCursor(doc.resolve(gapPos)) });

      const { ok, next } = run(command, state);

      expect(ok).toBe(true);
      const labels = next!.doc.content.content.map((child) =>
        child.type.name === "image" ? String(child.attrs.alt) : child.textContent,
      );
      expect(labels).toEqual(order);
      const movedIndex = labels.indexOf("BBB");
      const expectedGap =
        where === "end"
          ? blockPos(next!.doc, movedIndex) + next!.doc.child(movedIndex).nodeSize
          : blockPos(next!.doc, movedIndex);
      expect(next!.selection).toBeInstanceOf(GapCursor);
      expect(next!.selection.from).toBe(expectedGap);
    },
  );

  it("WHEN 전체 선택으로 moveBlockUp · moveBlockDown THEN 둘 다 false다", () => {
    const doc = docOf(paragraph("첫"), paragraph("끝"));
    const state = EditorState.create({ doc, selection: new AllSelection(doc) });

    expect(run(moveBlockUp, state).ok).toBe(false);
    expect(run(moveBlockDown, state).ok).toBe(false);
  });

  it.each([
    ["첫 블록에서 moveBlockUp", moveBlockUp, 0],
    ["마지막 블록에서 moveBlockDown", moveBlockDown, 1],
  ] as const)("WHEN %s THEN false이고 dispatch가 불리지 않는다", (_name, command, index) => {
    const doc = docOf(paragraph("첫"), paragraph("끝"));
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, blockPos(doc, index) + 1),
    });

    const { ok, next } = run(command, state);

    expect(ok).toBe(false);
    expect(next).toBeNull();
  });

  it("WHEN decorationMax에서 스티커가 붙은 블록을 한 칸 옮긴다 THEN 그 블록 attrs가 같고 docFromNode를 통과한다", () => {
    const doc = docToNode(schema, fixtures.decorationMax.doc);
    const index = doc.content.content.findIndex(
      (child) => Array.isArray(child.attrs.stickers) && child.attrs.stickers.length > 0,
    );
    const command = index === 0 ? moveBlockDown : moveBlockUp;
    const target = index === 0 ? 1 : index - 1;
    const block = doc.child(index);
    const state = EditorState.create({
      doc,
      selection: NodeSelection.create(doc, blockPos(doc, index)),
    });

    const { ok, next } = run(command, state);

    expect(ok).toBe(true);
    expect(next!.doc.child(target).attrs).toEqual(block.attrs);
    expect(next!.doc.child(target).eq(block)).toBe(true);
    expect(() => docFromNode(next!.doc)).not.toThrow();
  });

  it("WHEN history가 있는 상태에서 moveBlockDown 뒤 undo 한 번 THEN 문서가 옮기기 전과 같다", () => {
    const doc = docOf(paragraph("하나"), paragraph("둘"), paragraph("셋"));
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 2),
      plugins: [history()],
    });

    const moved = run(moveBlockDown, state).next!;
    let undone: EditorState | null = null;
    undo(moved, (tr) => {
      undone = moved.apply(tr);
    });

    expect(blockTexts(moved.doc)).toEqual(["둘", "하나", "셋"]);
    expect(undone!.doc.eq(doc)).toBe(true);
  });
});

describe("editor-move-block: 단축키는 Mod-Shift-화살표다", () => {
  it("WHEN 가운데 블록에서 Mod-Shift-ArrowUp 핸들러를 부른다 THEN 블록이 올라간다", () => {
    const doc = docOf(paragraph("AAA"), paragraph("BBB"));
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, blockPos(doc, 1) + 1),
    });

    const { ok, next } = run(moveBlockKeymap["Mod-Shift-ArrowUp"]!, state);

    expect(ok).toBe(true);
    expect(blockTexts(next!.doc)).toEqual(["BBB", "AAA"]);
  });

  it.each([
    ["첫 블록에서 Mod-Shift-ArrowUp", "Mod-Shift-ArrowUp", 0],
    ["마지막 블록에서 Mod-Shift-ArrowDown", "Mod-Shift-ArrowDown", 1],
  ] as const)("WHEN %s THEN 키를 삼키고(true) 문서는 그대로다", (_name, key, index) => {
    const doc = docOf(paragraph("첫"), paragraph("끝"));
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, blockPos(doc, index) + 1),
    });

    const { ok, next } = run(moveBlockKeymap[key]!, state);

    expect(ok).toBe(true);
    expect(next).toBeNull();
  });
});
