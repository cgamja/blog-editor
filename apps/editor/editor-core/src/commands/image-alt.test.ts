import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import { ALT_MAX_LENGTH } from "@blog-editor/content-schema";
import {
  ALT_MISSING_ATTR,
  createEditorSchema,
  docToNode,
  imageAltReminder,
  imageAltReminderKey,
  setImageAlt,
} from "../index";

const schema = createEditorSchema();

/** 문단 "가"(0–3) 뒤 대체 텍스트가 빈 그림(3–4) */
function start(): EditorState {
  const doc = docToNode(schema, {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "가" }] },
      {
        type: "image",
        attrs: { src: "/images/a.webp", alt: "", naturalWidth: 800, naturalHeight: 600 },
      },
    ],
  });
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, 1),
    plugins: [imageAltReminder()],
  });
}

const IMAGE = 3;

function run(state: EditorState, command: Command): { ok: boolean; state: EditorState } {
  let next = state;
  const ok = command(state, (tr) => {
    next = state.apply(tr);
  });
  return { ok, state: next };
}

function missingAltPositions(state: EditorState): number[] {
  const plugin = imageAltReminderKey.get(state);
  const set = plugin?.props.decorations?.call(plugin, state) as DecorationSet | undefined;
  // 노드 장식의 속성은 공개 타입 밖(type.attrs)에만 있다 — DOM 없이 달린 속성을 볼 다른 길이 없다
  return (set?.find() ?? [])
    .filter(
      (decoration) =>
        ALT_MISSING_ATTR in (decoration as unknown as { type: { attrs: object } }).type.attrs,
    )
    .map((decoration) => decoration.from);
}

describe("editor-image-insert: 그림의 대체 텍스트를 넣을 수 있고 비어 있으면 알린다", () => {
  it("WHEN alt가 빈 그림에 setImageAlt(pos, '낮잠 자는 아기') THEN alt가 바뀌고 경고 장식이 전에는 있고 뒤에는 없다", () => {
    const initial = start();
    expect(missingAltPositions(initial)).toEqual([IMAGE]);

    const { ok, state } = run(initial, setImageAlt(IMAGE, "낮잠 자는 아기"));

    expect(ok).toBe(true);
    expect(state.doc.nodeAt(IMAGE)?.attrs.alt).toBe("낮잠 자는 아기");
    expect(missingAltPositions(state)).toEqual([]);
  });

  it("WHEN ALT_MAX_LENGTH + 1자를 넣는다 THEN false이고 문서는 그대로다", () => {
    const initial = start();

    const { ok, state } = run(initial, setImageAlt(IMAGE, "가".repeat(ALT_MAX_LENGTH + 1)));

    expect(ok).toBe(false);
    expect(state.doc.eq(initial.doc)).toBe(true);
  });
});
