import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import {
  createEditorSchema,
  docToNode,
  hideSticker,
  moveStickerToBlock,
  stickerHiding,
  stickerHidingKey,
} from "../index";

const schema = createEditorSchema();

type Json = Record<string, unknown>;

const heart = { id: "heart", x: 10, y: 20, size: 30, rotate: 0 };
const paragraph = (value: string, attrs?: Json): Json => ({
  type: "paragraph",
  ...(attrs === undefined ? {} : { attrs }),
  content: [{ type: "text", text: value }],
});

/** 첫 문단 "가"(크기 3) 뒤 둘째 문단에 스티커 둘 */
function start(): EditorState {
  const node = docToNode(schema, {
    type: "doc",
    content: [paragraph("가"), paragraph("나", { stickers: [heart, { ...heart, x: 60 }] })],
  });
  return EditorState.create({
    doc: node,
    selection: TextSelection.create(node, 1),
    plugins: [stickerHiding()],
  });
}

const SECOND = 3;

function run(state: EditorState, command: Command): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

interface HidingDecoration {
  from: number;
  to: number;
  attrs: unknown;
}

function hidingDecorations(state: EditorState): HidingDecoration[] {
  const plugin = stickerHidingKey.get(state);
  const set = plugin?.props.decorations?.call(plugin, state) as DecorationSet | undefined;
  return (set?.find() ?? []).map((decoration) => ({
    from: decoration.from,
    to: decoration.to,
    // 노드 장식의 속성은 공개 타입 밖(type.attrs)에만 있다 — DOM 없이 달린 속성을 볼 다른 길이 없다
    attrs: (decoration as unknown as { type: { attrs: unknown } }).type.attrs,
  }));
}

describe("editor-sticker-edit: 끄는 동안 원래 자리의 스티커를 숨긴다", () => {
  it("WHEN 둘째 문단 순번 1로 hideSticker 뒤 hideSticker(null)을 실행한다 THEN 첫 실행 뒤 둘째 문단에 data-sticker-hidden=1 장식이 있고 문서는 같으며 둘째 실행 뒤 장식이 없다", () => {
    const initial = start();

    const hidden = run(initial, hideSticker({ blockPos: SECOND, index: 1 }));
    expect(hidden.ok).toBe(true);
    expect(hidden.state.doc.eq(initial.doc)).toBe(true);
    expect(hidingDecorations(hidden.state)).toEqual([
      {
        from: SECOND,
        to: SECOND + initial.doc.child(1).nodeSize,
        attrs: { "data-sticker-hidden": "1" },
      },
    ]);

    const shown = run(hidden.state, hideSticker(null));
    expect(shown.ok).toBe(true);
    expect(hidingDecorations(shown.state)).toEqual([]);
  });

  it("WHEN 숨긴 상태에서 메타 없이 선택만 옮기는 트랜잭션을 적용한다 THEN 장식이 그대로 하나 있다", () => {
    const hidden = run(start(), hideSticker({ blockPos: SECOND, index: 1 })).state;

    const moved = hidden.apply(hidden.tr.setSelection(TextSelection.create(hidden.doc, 4)));

    expect(hidingDecorations(moved)).toHaveLength(1);
  });

  it("WHEN 숨긴 상태에서 그 스티커를 첫 문단으로 옮기는 트랜잭션을 적용한다 THEN 장식이 없다", () => {
    const hidden = run(start(), hideSticker({ blockPos: SECOND, index: 1 })).state;

    const moved = run(
      hidden,
      moveStickerToBlock(SECOND, 1, { blockPos: 0, x: 50, y: 50, size: 10 }),
    );

    expect(moved.ok).toBe(true);
    expect(hidingDecorations(moved.state)).toEqual([]);
  });
});
