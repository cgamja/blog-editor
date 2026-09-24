import { history, undo } from "@tiptap/pm/history";
import type { Node } from "@tiptap/pm/model";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { AllSelection, EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Command, Selection } from "@tiptap/pm/state";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import {
  addSticker,
  blockGuard,
  createEditorSchema,
  docFromNode,
  docToNode,
  moveStickerToBlock,
  placeOnNearestBlock,
  removeSticker,
  setBlockFont,
  setBlockMotion,
  setBlockWidth,
  updateSticker,
} from "../index";

// ── 문서 · 상태 도구 (EditorState만 — DOM · EditorView 없음) ──

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const text = (value: string): Json => ({ type: "text", text: value });
const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [text(value)],
});
const heading = (value: string): Json => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(value)],
});
const codeBlock = (value: string): Json => ({ type: "codeBlock", content: [text(value)] });
const bulletList = (value: string): Json => ({
  type: "bulletList",
  content: [{ type: "listItem", content: [paragraph(value)] }],
});
const image = (): Json => ({ type: "image", attrs: { src: "/images/a.webp", alt: "그림" } });
const doc = (...blocks: Json[]): Json => ({ type: "doc", content: blocks });

const heart = { id: "heart", x: 10, y: 20, size: 30, rotate: 0 };
const cloud = { id: "cloud", x: 40, y: 50, size: 30, rotate: 90 };

/** 최상위 블록 index 바로 앞 위치 */
function blockStart(node: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += node.child(i).nodeSize;
  return pos;
}

type Place = (node: Node) => Selection;

/** 최상위 블록 index의 첫 텍스트 자리(depth겹 안쪽) */
const at =
  (index: number, depth = 1): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, index) + depth);
/** 최상위 블록 from의 첫 글자부터 to의 첫 글자 뒤까지 */
const across =
  (from: number, to: number): Place =>
  (node) =>
    TextSelection.create(node, blockStart(node, from) + 1, blockStart(node, to) + 2);
const nodeAt =
  (index: number): Place =>
  (node) =>
    NodeSelection.create(node, blockStart(node, index));
const atDocEnd: Place = (node) => new GapCursor(node.resolve(node.content.size));
const all: Place = (node) => new AllSelection(node);

// 모든 상태에 blockGuard를 단다 — 결과가 가드를 통과해야 문서가 실제로 바뀐다
function stateAt(raw: Json, place: Place = at(0)): EditorState {
  const node = docToNode(schema, raw);
  return EditorState.create({
    doc: node,
    selection: place(node),
    plugins: [blockGuard(), history()],
  });
}

interface CommandRun {
  ok: boolean;
  state: EditorState;
  /** 결과 문서를 저장 형식으로 — 저장할 수 없는 문서면 docFromNode가 던진다 */
  saved: Doc;
}

/** 실행하고, dispatch 없이 물은 답(can)이 실행 결과와 같은지도 확인한다 */
function run(state: EditorState, command: Command): CommandRun {
  const can = command(state);
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  expect(can).toBe(ok);
  return { ok, state: next, saved: docFromNode(next.doc) };
}

/** 거절 — false이고 문서가 그대로다 */
function expectRejected(state: EditorState, command: Command) {
  const result = run(state, command);
  expect(result.ok).toBe(false);
  expect(result.state.doc.eq(state.doc)).toBe(true);
}

const attrsOf = (saved: Doc, index: number) =>
  (saved.content[index] as { attrs?: Json }).attrs ?? {};

const posOf = (state: EditorState, index: number) => blockStart(state.doc, index);

// ── 시나리오 ──

describe("editor-decoration: 블록의 글꼴 · 움직임을 바꾼다", () => {
  it("WHEN 문단 둘 중 첫 문단에 커서를 두고 setBlockFont('jua') THEN 첫 문단만 font가 jua다", () => {
    const state = stateAt(doc(paragraph("가"), paragraph("나")), at(0));

    const result = run(state, setBlockFont("jua"));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({ font: "jua" });
    expect(attrsOf(result.saved, 1)).toEqual({});
  });

  it("WHEN 문단과 제목에 걸친 선택에서 setBlockMotion('pop') THEN 두 블록 모두 motion이 pop이다", () => {
    const state = stateAt(doc(paragraph("가"), heading("나")), across(0, 1));

    const result = run(state, setBlockMotion("pop"));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({ motion: "pop" });
    expect(attrsOf(result.saved, 1)).toMatchObject({ motion: "pop" });
  });

  it("WHEN 글머리 목록 항목 안에 커서를 두고 setBlockFont('gaegu') THEN 최상위 목록의 font가 gaegu이고 안쪽에는 꾸미기가 없다", () => {
    // 목록 · 항목 · 문단 세 겹 안쪽
    const state = stateAt(doc(bulletList("가")), at(0, 3));

    const result = run(state, setBlockFont("gaegu"));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({ font: "gaegu" });
    const list = result.saved.content[0] as { content?: unknown[] };
    expect(JSON.stringify(list.content)).not.toContain("gaegu");
  });

  it("WHEN font가 jua인 문단에서 setBlockFont(null) THEN 그 문단에 font가 없다", () => {
    const state = stateAt(doc(paragraph("가", { font: "jua" })));

    const result = run(state, setBlockFont(null));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({});
  });

  it.each([
    [
      "jua 문단에 setBlockFont('jua')",
      stateAt(doc(paragraph("가", { font: "jua" }))),
      setBlockFont("jua"),
    ],
    ["font 없는 문단에 setBlockFont(null)", stateAt(doc(paragraph("가"))), setBlockFont(null)],
  ] as const)(
    "WHEN 이미 같은 값인 블록에 %s THEN true이지만 dispatch하지 않는다(undo 단계가 쌓이지 않는다)",
    (_name, state, command) => {
      let dispatched = 0;
      const ok = command(state, () => {
        dispatched += 1;
      });

      expect(command(state)).toBe(true);
      expect(ok).toBe(true);
      expect(dispatched).toBe(0);
    },
  );

  it.each([
    ["코드 블록에 font", stateAt(doc(codeBlock("x")), at(0)), setBlockFont("jua")],
    ["집합 밖 font", stateAt(doc(paragraph("가"))), setBlockFont("comic")],
    ["집합 밖 motion", stateAt(doc(paragraph("가"))), setBlockMotion("spin")],
    ["GapCursor", stateAt(doc(image()), atDocEnd), setBlockMotion("pop")],
    ["AllSelection", stateAt(doc(paragraph("가")), all), setBlockMotion("pop")],
  ] as const)("WHEN %s THEN false이고 문서가 그대로다", (_name, state, command) => {
    expectRejected(state, command);
  });
});

describe("editor-decoration: 그림 · 앱 스크린샷의 폭을 바꾼다", () => {
  it("WHEN 그림을 노드 선택하고 setBlockWidth(50) THEN width가 50이고 선택은 그 그림의 노드 선택이다", () => {
    const state = stateAt(doc(paragraph("가"), image()), nodeAt(1));

    const result = run(state, setBlockWidth(50));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 1)).toMatchObject({ width: 50 });
    expect(result.state.selection).toBeInstanceOf(NodeSelection);
    expect(result.state.selection.from).toBe(posOf(state, 1));
  });

  it.each([
    ["문단에 폭 50", stateAt(doc(paragraph("가"))), 50],
    ["그림에 폭 24(범위 아래)", stateAt(doc(image()), nodeAt(0)), 24],
    ["그림에 폭 101(범위 위)", stateAt(doc(image()), nodeAt(0)), 101],
    ["그림에 폭 50.5(정수 아님)", stateAt(doc(image()), nodeAt(0)), 50.5],
  ] as const)("WHEN %s THEN false이고 문서가 그대로다", (_name, state, width) => {
    expectRejected(state, setBlockWidth(width));
  });
});

describe("editor-decoration: 스티커를 넣고 고치고 지우고 옮긴다", () => {
  it("WHEN 문단에 커서를 두고 addSticker('heart') THEN 기본 자리 스티커 하나가 붙는다", () => {
    const state = stateAt(doc(paragraph("가")));

    const result = run(state, addSticker("heart"));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({
      stickers: [{ id: "heart", x: 95, y: 5, size: 15, rotate: 0 }],
    });
  });

  it("WHEN 둘째 블록 위치와 좌표로 addSticker('cloud', …) THEN 둘째 블록 스티커 끝에 그 값이 붙는다", () => {
    const state = stateAt(doc(paragraph("가"), paragraph("나", { stickers: [heart] })));
    const placement = { blockPos: posOf(state, 1), x: 10, y: 20, size: 30, rotate: -15 };

    const result = run(state, addSticker("cloud", placement));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 1)).toEqual({
      stickers: [heart, { id: "cloud", x: 10, y: 20, size: 30, rotate: -15 }],
    });
    expect(attrsOf(result.saved, 0)).toEqual({});
  });

  it("WHEN 상한 · 모르는 id · 범위 밖 좌표 · 정수 아닌 크기 · 블록 경계가 아닌 위치로 addSticker THEN 모두 false이고 문서가 그대로다", () => {
    const full = stateAt(
      doc(paragraph("가", { stickers: Array.from({ length: MAX_STICKERS_PER_DOC }, () => heart) })),
    );
    const empty = stateAt(doc(paragraph("가"), paragraph("나")));
    const place = (overrides: Json) => ({
      blockPos: 0,
      x: 10,
      y: 20,
      size: 30,
      rotate: 0,
      ...overrides,
    });

    expectRejected(full, addSticker("heart"));
    expectRejected(empty, addSticker("unicorn"));
    expectRejected(empty, addSticker("heart", place({ x: 126 })));
    expectRejected(empty, addSticker("heart", place({ size: 4.5 })));
    expectRejected(empty, addSticker("heart", place({ blockPos: 1 })));
  });

  it("WHEN 스티커 둘 중 둘째에 updateSticker(pos, 1, { size: 40, rotate: 30 }) THEN 둘째만 바뀐다 — 범위 밖 · 없는 순번은 false", () => {
    const state = stateAt(doc(paragraph("가", { stickers: [heart, cloud] })));

    const result = run(state, updateSticker(0, 1, { size: 40, rotate: 30 }));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({
      stickers: [heart, { ...cloud, size: 40, rotate: 30 }],
    });
    expectRejected(state, updateSticker(0, 1, { rotate: 181 }));
    expectRejected(state, updateSticker(0, 2, { size: 40 }));
  });

  it("WHEN 스티커 하나가 붙은 블록에서 removeSticker(pos, 0) THEN 그 블록에 stickers가 없다", () => {
    const state = stateAt(doc(paragraph("가", { stickers: [heart] })));

    const result = run(state, removeSticker(0, 0));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({});
  });

  it.each([
    ["정수 아닌 순번 0.5", 0.5],
    ["없는 순번 1", 1],
  ] as const)(
    "WHEN 스티커 하나인 블록에서 removeSticker(pos, %s) THEN false이고 문서가 그대로다",
    (_name, index) => {
      const state = stateAt(doc(paragraph("가", { stickers: [heart] })));

      expectRejected(state, removeSticker(0, index));
    },
  );

  it("WHEN 같은 블록 안으로 moveStickerToBlock THEN 제자리에서 좌표만 바뀌고 회전은 유지된다 — 없는 순번은 false", () => {
    const state = stateAt(doc(paragraph("가", { stickers: [heart, cloud] })));
    const target = { blockPos: 0, x: 60, y: 70, size: 25 };

    const result = run(state, moveStickerToBlock(0, 1, target));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({
      stickers: [heart, { id: "cloud", x: 60, y: 70, size: 25, rotate: 90 }],
    });
    expectRejected(state, moveStickerToBlock(0, 2, target));
  });

  it("WHEN rotate 90 스티커를 moveStickerToBlock으로 둘째 블록에 옮긴다 THEN 첫 블록에서 빠지고 둘째 블록 끝에 새 좌표 · 같은 회전으로 붙는다", () => {
    const state = stateAt(
      doc(paragraph("가", { stickers: [cloud] }), paragraph("나", { stickers: [heart] })),
    );
    const target = { blockPos: posOf(state, 1), x: 50, y: 50, size: 20 };

    const result = run(state, moveStickerToBlock(0, 0, target));

    expect(result.ok).toBe(true);
    expect(attrsOf(result.saved, 0)).toEqual({});
    expect(attrsOf(result.saved, 1)).toEqual({
      stickers: [heart, { id: "cloud", x: 50, y: 50, size: 20, rotate: 90 }],
    });
  });

  it("WHEN 스티커를 다른 블록으로 옮긴 뒤 undo 한 번 THEN 문서가 옮기기 전과 같다", () => {
    const state = stateAt(doc(paragraph("가", { stickers: [cloud] }), paragraph("나")));
    const target = { blockPos: posOf(state, 1), x: 50, y: 50, size: 20 };
    const moved = run(state, moveStickerToBlock(0, 0, target));

    let undone = moved.state;
    undo(moved.state, (tr) => {
      undone = moved.state.apply(tr);
    });

    expect(moved.ok).toBe(true);
    expect(undone.doc.eq(state.doc)).toBe(true);
  });
});

describe("editor-decoration: 놓은 자리에서 가장 가까운 블록과 % 좌표를 구한다", () => {
  const upper = { pos: 0, left: 100, top: 0, width: 600, height: 100 };
  const lower = { pos: 7, left: 100, top: 140, width: 600, height: 100 };

  it("WHEN 블록 안 점 (400, 25)에 폭 90px 스티커 THEN 그 블록 기준 { x: 50, y: 25, size: 15 }", () => {
    expect(placeOnNearestBlock([upper], { x: 400, y: 25 }, 90)).toEqual({
      blockPos: 0,
      x: 50,
      y: 25,
      size: 15,
    });
  });

  it("WHEN 두 블록 사이 y = 130에 놓는다 THEN 더 가까운 아래 블록에 음수 y %로 붙는다", () => {
    expect(placeOnNearestBlock([upper, lower], { x: 400, y: 130 }, 90)).toEqual({
      blockPos: 7,
      x: 50,
      y: -10,
      size: 15,
    });
  });

  it("WHEN 두 블록까지 거리가 같은 점에 놓는다 THEN 앞 블록에 붙는다", () => {
    expect(placeOnNearestBlock([upper, lower], { x: 400, y: 120 }, 90)).toEqual({
      blockPos: 0,
      x: 50,
      y: 120,
      size: 15,
    });
  });

  it("WHEN 멀리 떨어진 점 · 블록 폭 절반보다 큰 스티커 · 빈 목록 THEN null", () => {
    expect(placeOnNearestBlock([upper], { x: 400, y: 900 }, 90)).toBeNull();
    expect(placeOnNearestBlock([upper], { x: 400, y: 25 }, 400)).toBeNull();
    expect(placeOnNearestBlock([], { x: 400, y: 25 }, 90)).toBeNull();
  });
});
