import type { Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { MAX_STICKERS_PER_DOC } from "@blog-editor/content-schema";
import type { Doc } from "@blog-editor/content-schema";
import {
  blockGuard,
  createEditorSchema,
  docFromNode,
  docToNode,
  isStickerRemoveKey,
  mapStickerRef,
  pasteStickerBeside,
  placeStickerNear,
  removeSticker,
  stickerCount,
  stickerKeyCommand,
  stickersIn,
} from "../index";
import type { BlockRect } from "../index";

// ── 문서 · 상태 도구 (EditorState만 — DOM · EditorView 없음) ──

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [{ type: "text", text: value }],
});
const doc = (...blocks: Json[]): Json => ({ type: "doc", content: blocks });

const sticker = (fields: Partial<Record<"x" | "y" | "size" | "rotate", number>> = {}) => ({
  id: "heart" as const,
  x: 10,
  y: 20,
  size: 30,
  rotate: 0,
  ...fields,
});
const withStickers = (...stickers: Json[]) => paragraph("가", { stickers });

function stateOf(raw: Json): EditorState {
  const node = docToNode(schema, raw);
  return EditorState.create({
    doc: node,
    selection: TextSelection.create(node, 1),
    plugins: [blockGuard()],
  });
}

/** 최상위 블록 index 바로 앞 위치 */
function blockStart(node: Node, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += node.child(i).nodeSize;
  return pos;
}

/** 실행하고, dispatch 없이 물은 답(can)이 실행 결과와 같은지도 확인한다 */
function run(state: EditorState, command: Command) {
  const can = command(state);
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  expect(can).toBe(ok);
  return { ok, state: next, saved: docFromNode(next.doc) };
}

const stickersOf = (saved: Doc, index: number) =>
  ((saved.content[index] as { attrs?: Json }).attrs?.stickers ?? []) as Json[];

/** 첫 블록 첫 스티커에 키를 누른 결과 */
function press(state: EditorState, key: string) {
  const command = stickerKeyCommand({ blockPos: 0, index: 0 }, key);
  expect(command).not.toBeNull();
  return run(state, command!);
}

// ── 시나리오 ──

describe("editor-sticker-edit: 키 하나가 고른 스티커를 조작한다", () => {
  it("WHEN x 10 · y 20 스티커에 ArrowRight, 이어서 ArrowUp THEN x 11 · y 19다", () => {
    const moved = press(stateOf(doc(withStickers(sticker()))), "ArrowRight");
    const lifted = press(moved.state, "ArrowUp");

    expect(stickersOf(lifted.saved, 0)[0]).toMatchObject({ x: 11, y: 19 });
  });

  it("WHEN 크기 30 스티커에 +, =, - 를 차례로 THEN 크기가 31, 32, 31이다", () => {
    const sizes: unknown[] = [];
    let state = stateOf(doc(withStickers(sticker({ size: 30 }))));
    for (const key of ["+", "=", "-"]) {
      const result = press(state, key);
      state = result.state;
      sizes.push(stickersOf(result.saved, 0)[0]!.size);
    }

    expect(sizes).toEqual([31, 32, 31]);
  });

  it.each([
    [0, "]", 15],
    [175, "]", -170],
    [-170, "[", 175],
  ])("WHEN 회전 %i 스티커에 %s THEN 회전이 %i다", (rotate, key, expected) => {
    const result = press(stateOf(doc(withStickers(sticker({ rotate })))), key);

    expect(stickersOf(result.saved, 0)[0]!.rotate).toBe(expected);
  });

  it.each(["Delete", "Backspace"])(
    "WHEN 스티커 둘인 블록의 첫 스티커에 %s THEN 그 스티커만 없다",
    (key) => {
      const second = { ...sticker({ x: 70 }), id: "cloud" };
      const result = press(stateOf(doc(withStickers(sticker(), second))), key);

      expect(stickersOf(result.saved, 0)).toEqual([second]);
    },
  );

  it("WHEN x 125 스티커에 ArrowRight, 크기 50 스티커에 + 를 실행하고 a 키로 커맨드를 찾는다 THEN 앞의 둘은 false · 문서 그대로, a는 null이다", () => {
    for (const [fields, key] of [
      [{ x: 125 }, "ArrowRight"],
      [{ size: 50 }, "+"],
    ] as const) {
      const state = stateOf(doc(withStickers(sticker(fields))));
      const result = press(state, key);

      expect(result.ok).toBe(false);
      expect(result.state.doc.eq(state.doc)).toBe(true);
    }
    expect(stickerKeyCommand({ blockPos: 0, index: 0 }, "a")).toBeNull();
  });
});

describe("editor-sticker-edit: 고른 스티커 참조는 트랜잭션을 따라간다", () => {
  it("WHEN 둘째 블록 스티커 참조가 있고 첫 블록에 글자 셋을 넣는다 THEN blockPos가 3 늘고 순번은 그대로다", () => {
    const state = stateOf(doc(paragraph("가"), withStickers(sticker())));
    const ref = { blockPos: blockStart(state.doc, 1), index: 0 };
    const tr = state.tr.insertText("나다라", 2);

    expect(mapStickerRef(ref, tr.mapping, tr.doc)).toEqual({
      blockPos: ref.blockPos + 3,
      index: 0,
    });
  });

  it("WHEN 참조한 블록을 지우거나, 순번 1을 가리키는데 스티커 하나를 지운다 THEN 둘 다 null이다", () => {
    const state = stateOf(doc(paragraph("가"), withStickers(sticker(), sticker({ x: 70 }))));
    const blockPos = blockStart(state.doc, 1);

    const deleted = state.tr.delete(blockPos, blockPos + state.doc.child(1).nodeSize);
    expect(mapStickerRef({ blockPos, index: 0 }, deleted.mapping, deleted.doc)).toBeNull();

    const shortened = run(state, removeSticker(blockPos, 0)).state;
    const unchanged = shortened.tr;
    expect(mapStickerRef({ blockPos, index: 1 }, unchanged.mapping, shortened.doc)).toBeNull();
  });
});

describe("editor-sticker-edit: 놓은 점은 거리와 상관없이 가장 가까운 허용 자리에 붙는다", () => {
  const block = (pos: number, rect: Omit<BlockRect, "pos">): BlockRect => ({ pos, ...rect });

  it("WHEN 폭 600 · 높이 100 블록의 (300, 50)에 폭 60 스티커를 놓는다 THEN x 50 · y 50 · size 10이다", () => {
    const blocks = [block(0, { left: 0, top: 0, width: 600, height: 100 })];

    expect(placeStickerNear(blocks, { x: 300, y: 50 }, 60)).toEqual({
      blockPos: 0,
      x: 50,
      y: 50,
      size: 10,
    });
  });

  it("WHEN 높이 20 문단 바로 아래 12px(허용 밖)에 놓고 그 아래 높이 200 블록의 허용 안이다 THEN 아래 블록에 붙는다", () => {
    const blocks = [
      block(0, { left: 0, top: 0, width: 600, height: 20 }),
      block(5, { left: 0, top: 40, width: 600, height: 200 }),
    ];

    expect(placeStickerNear(blocks, { x: 300, y: 32 }, 60)).toMatchObject({ blockPos: 5, y: -4 });
  });

  it("WHEN 높이 20 문단 둘 사이 22px 틈의 한가운데에 놓는다 THEN 위 문단의 y 125에 붙는다", () => {
    const blocks = [
      block(0, { left: 0, top: 0, width: 600, height: 20 }),
      block(5, { left: 0, top: 42, width: 600, height: 20 }),
    ];

    expect(placeStickerNear(blocks, { x: 300, y: 31 }, 60)).toEqual({
      blockPos: 0,
      x: 50,
      y: 125,
      size: 10,
    });
  });

  it("WHEN 유일한 블록(폭 600 · 높이 20) 아래로 100px, 왼쪽으로 400px 떨어진 곳에 놓는다 THEN 그 블록의 x -25 · y 125에 붙는다", () => {
    const blocks = [block(0, { left: 0, top: 0, width: 600, height: 20 })];

    expect(placeStickerNear(blocks, { x: -400, y: 120 }, 60)).toEqual({
      blockPos: 0,
      x: -25,
      y: 125,
      size: 10,
    });
  });

  it("WHEN 폭 100 블록 하나뿐인 곳에 폭 60 스티커를 놓는다 THEN null이다", () => {
    const blocks = [block(0, { left: 0, top: 0, width: 100, height: 100 })];

    expect(placeStickerNear(blocks, { x: 50, y: 50 }, 60)).toBeNull();
  });

  it("WHEN 폭 100 블록(스티커 60px = 60%) 안에 놓고 120px 오른쪽에서 폭 600 블록이 시작한다 THEN 폭 600 블록의 x -25에 size 10으로 붙는다", () => {
    const blocks = [
      block(0, { left: 0, top: 0, width: 100, height: 100 }),
      block(5, { left: 220, top: 0, width: 600, height: 100 }),
    ];

    expect(placeStickerNear(blocks, { x: 50, y: 50 }, 60)).toEqual({
      blockPos: 5,
      x: -25,
      y: 50,
      size: 10,
    });
  });
});

describe("editor-sticker-edit: 보조키가 눌린 키는 스티커 조작이 아니다", () => {
  it("WHEN - 를 metaKey, [ 를 ctrlKey, ArrowLeft를 altKey와 함께 찾는다 THEN 모두 null이다", () => {
    const ref = { blockPos: 0, index: 0 };

    expect([
      stickerKeyCommand(ref, "-", { metaKey: true }),
      stickerKeyCommand(ref, "[", { ctrlKey: true }),
      stickerKeyCommand(ref, "ArrowLeft", { altKey: true }),
    ]).toEqual([null, null, null]);
  });

  it("WHEN isStickerRemoveKey에 Delete, Backspace, x THEN true, true, false다", () => {
    expect(["Delete", "Backspace", "x"].map(isStickerRemoveKey)).toEqual([true, true, false]);
  });
});

describe("editor-sticker-edit: 스티커 개수를 문서에서 센다", () => {
  it("WHEN 스티커 둘 · 하나인 문단에서 stickerCount, 둘째 문단 stickersIn, 경계 아닌 위치 stickersIn THEN 3, 길이 1, 빈 배열이다", () => {
    const state = stateOf(
      doc(withStickers(sticker(), sticker({ x: 70 })), withStickers(sticker())),
    );

    expect([
      stickerCount(state.doc),
      stickersIn(state.doc, blockStart(state.doc, 1)).length,
      stickersIn(state.doc, 1),
    ]).toEqual([3, 1, []]);
  });
});

describe("editor-sticker-copy: 복사해 둔 스티커를 고른 스티커 옆에 하나 더 붙인다", () => {
  const target = { blockPos: 0, index: 0 };

  it("WHEN heart x 10 · y 20 · size 12 · rotate 30을 복사해 그 스티커 옆에 붙인다 THEN 둘째가 x 15 · y 25인 같은 스티커다", () => {
    const copied = sticker({ size: 12, rotate: 30 });
    const result = run(stateOf(doc(withStickers(copied))), pasteStickerBeside(copied, target));

    expect(result.ok).toBe(true);
    expect(stickersOf(result.saved, 0)).toEqual([
      copied,
      { id: "heart", x: 15, y: 25, size: 12, rotate: 30 },
    ]);
  });

  it("WHEN x 125 · y 10 스티커 옆에 붙인다 THEN 새 스티커는 x 120 · y 15다", () => {
    const edge = sticker({ x: 125, y: 10 });
    const result = run(stateOf(doc(withStickers(edge))), pasteStickerBeside(edge, target));

    expect(stickersOf(result.saved, 0)[1]).toMatchObject({ x: 120, y: 15 });
  });

  it("WHEN 스티커가 12개인 글에서 붙인다 THEN false이고 문서가 그대로다", () => {
    const full = stateOf(
      doc(withStickers(...Array.from({ length: MAX_STICKERS_PER_DOC }, () => sticker()))),
    );
    const result = run(full, pasteStickerBeside(sticker(), target));

    expect(result.ok).toBe(false);
    expect(result.state.doc.eq(full.doc)).toBe(true);
  });
});
