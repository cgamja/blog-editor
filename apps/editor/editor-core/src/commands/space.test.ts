import { Fragment, Slice } from "@tiptap/pm/model";
import type { Node } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command, Selection } from "@tiptap/pm/state";
import type { Doc } from "@blog-editor/content-schema";
import {
  blockGuard,
  createEditorSchema,
  docFromNode,
  docToNode,
  listKeymap,
  normalizePastedSlice,
  setBlockSpace,
  splitBlockKeepingDecoration,
  turnIntoTextblock,
  wrapInBlockquote,
  wrapInBulletList,
  wrapInCallout,
  wrapInOrderedList,
} from "../index";
import { elementFromSpec, readWith } from "../dom.test.helpers";
import { pasteTransaction } from "../plugins/decoration-safe-paste";

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const text = (value: string): Json => ({ type: "text", text: value });
const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [text(value)],
});
const image = (attrs: Json = {}): Json => ({
  type: "image",
  attrs: { src: "/images/a.webp", alt: "그림", ...attrs },
});
const doc = (...blocks: Json[]): Json => ({ type: "doc", content: blocks });
const item = (value = ""): Json => ({
  type: "listItem",
  content: [value === "" ? { type: "paragraph" } : paragraph(value)],
});
const bullet = (items: Json[], attrs?: Json): Json => ({
  type: "bulletList",
  ...(attrs === undefined ? {} : { attrs }),
  content: items,
});
const sticker = { id: "heart", x: 50, y: 30, size: 20, rotate: 0 };

function blockStart(node: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += node.child(i).nodeSize;
  return pos;
}

type Place = (node: Node) => Selection;
/** 최상위 블록 index 안 글자 offset 자리 */
const at =
  (index: number, offset = 0): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, index) + 1 + offset);
const across =
  (from: number, to: number): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, from) + 1, blockStart(node, to + 1));
const nodeAt =
  (index: number): Place =>
  (node) =>
    NodeSelection.create(node, blockStart(node, index));

function stateAt(raw: Json, place: Place = at(0)): EditorState {
  const node = docToNode(schema, raw);
  return EditorState.create({ doc: node, selection: place(node), plugins: [blockGuard()] });
}

/** 실행하고, dispatch 없이 물은 답이 실행 결과와 같은지도 본다. 문서가 실제로 바뀌었는지(blockGuard 통과)도 돌려준다 */
function run(state: EditorState, command: Command): { ok: boolean; changed: boolean; saved: Doc } {
  const can = command(state);
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  expect(can).toBe(ok);
  return { ok, changed: next.doc !== state.doc, saved: docFromNode(next.doc) };
}

const attrsOf = (saved: Doc, index: number) =>
  (saved.content[index] as { attrs?: Json }).attrs ?? {};
const spacesOf = (saved: Doc) => saved.content.map((_, index) => attrsOf(saved, index).space);

describe("editor-decoration: 블록 간격을 바꾼다", () => {
  it("WHEN 문단 · 그림에 걸친 선택에서 setBlockSpace('lg') · 그림 노드 선택에서 null · 집합 밖 값 THEN lg가 붙고 null은 지우고 집합 밖은 false다", () => {
    const set = run(stateAt(doc(paragraph("가"), image()), across(0, 1)), setBlockSpace("lg"));
    expect(set.ok).toBe(true);
    expect(attrsOf(set.saved, 0)).toEqual({ space: "lg" });
    expect(attrsOf(set.saved, 1)).toMatchObject({ space: "lg" });

    const cleared = run(stateAt(doc(image({ space: "xl" })), nodeAt(0)), setBlockSpace(null));
    expect(cleared.ok).toBe(true);
    expect(attrsOf(cleared.saved, 0)).not.toHaveProperty("space");

    const state = stateAt(doc(paragraph("가")));
    expect(setBlockSpace("12px")(state)).toBe(false);
    expect(setBlockSpace("md")(state, () => undefined)).toBe(false);
  });
});

describe("editor-dom: 간격은 에디터 DOM에서도 data-space다", () => {
  it("WHEN 간격 xl 문단을 DOM 스펙으로 냈다가 파싱 규칙으로 다시 읽는다 THEN data-space로 나가고 space가 그대로 읽힌다", () => {
    const node = schema.nodes.paragraph!.create({ space: "xl", font: "jua" }, schema.text("가"));
    const spec = node.type.spec.toDOM!(node);

    expect(spec).toEqual([
      "div",
      { class: "post-block", "data-font": "jua", "data-space": "xl" },
      ["p", 0],
    ]);
    expect(readWith(schema, "nodes", "paragraph", elementFromSpec(spec))).toMatchObject({
      font: "jua",
      space: "xl",
    });
  });
});

describe("editor-paste: 간격은 붙여넣어도 한 조각에만 남는다", () => {
  it("WHEN 간격 lg 문단 조각을 안쪽 자리(인용 안)로 정규화한다 THEN space가 지워지고 최상위 자리면 남는다", () => {
    const piece = schema.nodes.paragraph!.create({ space: "lg" }, schema.text("가"));
    const slice = new Slice(Fragment.from(piece), 0, 0);

    const inner = normalizePastedSlice(slice, { intoTopLevel: false });
    const top = normalizePastedSlice(slice, { intoTopLevel: true });

    expect(inner.content.firstChild?.attrs.space).toBeNull();
    expect(top.content.firstChild?.attrs.space).toBe("lg");
  });

  it("WHEN 간격 lg 문단 글자 가운데에 닫힌 그림 하나를 붙인다 THEN 앞 조각만 간격을 갖고 그림 뒤 조각은 간격이 없다", () => {
    const state = stateAt(doc(paragraph("가나", { space: "lg" })), at(0, 1));
    const picture = schema.nodes.image!.create({ src: "/images/b.webp", alt: "b" });

    const next = state.apply(pasteTransaction(state, new Slice(Fragment.from(picture), 0, 0)));

    const saved = docFromNode(next.doc);
    expect(saved.content.map((block) => block.type)).toEqual(["paragraph", "image", "paragraph"]);
    expect(spacesOf(saved)).toEqual(["lg", undefined, undefined]);
  });

  it("WHEN 간격 lg 문단 abc|def에 끝이 열린 조각 [X, Y(간격 xl)]을 붙인다 THEN 앞 조각 abcX는 lg, 붙인 Y가 이어진 Ydef는 xl 그대로다", () => {
    const state = stateAt(doc(paragraph("abcdef", { space: "lg" })), at(0, 3));
    const pasted = Fragment.from([
      schema.nodes.paragraph!.create(null, schema.text("X")),
      schema.nodes.paragraph!.create({ space: "xl" }, schema.text("Y")),
    ]);

    const next = state.apply(pasteTransaction(state, new Slice(pasted, 1, 1)));

    const saved = docFromNode(next.doc);
    expect(next.doc.children.map((block) => block.textContent)).toEqual(["abcX", "Ydef"]);
    expect(spacesOf(saved)).toEqual(["lg", "xl"]);
  });
});

describe("editor-schema: 블록을 나눠도 간격은 앞 조각에만 남는다", () => {
  it.each([
    ["가운데", 1],
    ["맨 앞", 0],
  ] as const)(
    "WHEN 간격 lg 문단 %s에서 나눈다 THEN 앞 조각만 간격을 갖고 뒤 조각은 간격이 없으며 저장 가능하다",
    (_name, offset) => {
      const result = run(
        stateAt(doc(paragraph("가나", { space: "lg" })), at(0, offset)),
        splitBlockKeepingDecoration,
      );

      expect(result.ok).toBe(true);
      expect(result.saved.content).toHaveLength(2);
      expect(spacesOf(result.saved)).toEqual(["lg", undefined]);
    },
  );

  it("WHEN 간격 lg · 스티커 문단 맨 앞에서 나눈다 THEN 간격은 앞(빈) 조각에, 스티커는 글이 남은 뒤 조각에 있다", () => {
    const result = run(
      stateAt(doc(paragraph("가나", { space: "lg", stickers: [sticker] })), at(0, 0)),
      splitBlockKeepingDecoration,
    );

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({ space: "lg" });
    expect(attrsOf(result.saved, 1)).toEqual({ stickers: [sticker] });
  });
});

describe("editor-list-keys: 목록을 빼내도 간격은 한 조각에만 남는다", () => {
  it("WHEN 간격 lg 점 목록 [가, (빈), 다]의 빈 가운데 항목에서 Enter로 빼낸다 THEN 앞 목록만 lg, 빠진 문단 · 뒤 목록은 간격이 없다", () => {
    // at(0, 7) — 목록 여는 토큰 뒤 7칸: 첫 항목(5칸) · 둘째 항목 · 문단 여는 토큰을 지나 빈 문단 안
    const result = run(
      stateAt(doc(bullet([item("가"), item(), item("다")], { space: "lg" })), at(0, 7)),
      listKeymap.Enter!,
    );

    expect(result.ok).toBe(true);
    expect(result.saved.content.map((block) => block.type)).toEqual([
      "bulletList",
      "paragraph",
      "bulletList",
    ]);
    expect(spacesOf(result.saved)).toEqual(["lg", undefined, undefined]);
  });

  it("WHEN 항목 하나짜리 간격 lg 점 목록의 맨 앞에서 Backspace로 목록을 통째로 빼낸다 THEN 빠져나온 문단이 lg를 잇는다", () => {
    // at(0, 2) — 목록 · 항목 · 문단 여는 토큰 뒤, 가 앞
    const result = run(
      stateAt(doc(bullet([item("가")], { space: "lg" })), at(0, 2)),
      listKeymap.Backspace!,
    );

    expect(result.ok).toBe(true);
    expect(result.saved.content.map((block) => block.type)).toEqual(["paragraph"]);
    expect(spacesOf(result.saved)).toEqual(["lg"]);
  });

  // 세 키 모두 liftItemFixingSplit으로 모이지만, 빈 첫 항목 Enter는 enterInList의 다른 갈래를 탄다 — 키마다 한 줄
  it.each([
    ["Shift-Tab", "가"],
    ["Backspace", "가"],
    ["Enter", ""],
  ] as const)(
    "WHEN 앞 문단 뒤 간격 lg · 스티커 점 목록 [첫 항목, 나]의 첫 항목 맨 앞에서 %s(첫 항목 글자 '%s')로 빼낸다 THEN 빠진 첫 블록이 lg를 갖고 남은 목록은 간격 없이 스티커만 가진다",
    (key, first) => {
      // at(1, 2) — 목록 · 항목 · 문단 여는 토큰 뒤, 첫 항목 글자 앞
      const result = run(
        stateAt(
          doc(
            paragraph("앞"),
            bullet([item(first), item("나")], { space: "lg", stickers: [sticker] }),
          ),
          at(1, 2),
        ),
        listKeymap[key]!,
      );

      expect(result.ok).toBe(true);
      expect(result.saved.content.map((block) => block.type)).toEqual([
        "paragraph",
        "paragraph",
        "bulletList",
      ]);
      expect(attrsOf(result.saved, 1)).toEqual({ space: "lg" });
      expect(attrsOf(result.saved, 2)).toEqual({ stickers: [sticker] });
    },
  );
});

describe("editor-wrap: 감싸면 간격은 바깥 블록으로 옮기고 정렬은 지운다", () => {
  it.each([
    ["목록", wrapInBulletList],
    ["번호 목록", wrapInOrderedList],
    ["인용", wrapInBlockquote],
    ["콜아웃", wrapInCallout("tip")],
  ] as const)(
    "WHEN 간격 lg 문단을 %s으로 감싼다 THEN 문서가 바뀌고 간격은 바깥 블록에 있다",
    (_name, command) => {
      const result = run(stateAt(doc(paragraph("가", { space: "lg" }))), command);

      expect(result.ok).toBe(true);
      expect(result.changed).toBe(true);
      expect(attrsOf(result.saved, 0)).toMatchObject({ space: "lg" });
    },
  );

  it("WHEN 가운데 정렬 문단을 목록으로 감싼다 THEN 문서가 바뀌고 목록 · 안쪽 문단 어디에도 정렬이 없다(목록은 정렬 자리가 없다)", () => {
    const result = run(stateAt(doc(paragraph("가", { align: "center" }))), wrapInBulletList);

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(JSON.stringify(result.saved)).not.toContain("align");
  });
});

describe("editor-markdown-shortcuts: 블록을 바꿔도 간격은 남는다", () => {
  it("WHEN 간격 lg 문단을 제목으로 바꾼다 THEN 제목에 간격 lg가 있다", () => {
    const result = run(
      stateAt(doc(paragraph("가나", { space: "lg" }))),
      turnIntoTextblock("heading", { level: 2 }),
    );

    expect(result.ok).toBe(true);
    expect(result.saved.content[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2, space: "lg" },
    });
  });
});
