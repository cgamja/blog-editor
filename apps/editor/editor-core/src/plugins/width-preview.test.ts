import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import {
  createEditorSchema,
  docToNode,
  previewBlockWidth,
  widthPreview,
  widthPreviewKey,
} from "../index";

const schema = createEditorSchema();

const image = {
  type: "image",
  attrs: { src: "/images/a.webp", naturalWidth: 1600, naturalHeight: 1000, alt: "그림" },
};

/** 문단 "가"(크기 3) 뒤 그림 */
function start(): EditorState {
  const doc = docToNode(schema, {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "가" }] }, image],
  });
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, 1),
    plugins: [widthPreview()],
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

function previewAttrs(state: EditorState): unknown[] {
  const plugin = widthPreviewKey.get(state);
  const set = plugin?.props.decorations?.call(plugin, state) as DecorationSet | undefined;
  // 노드 장식의 속성은 공개 타입 밖(type.attrs)에만 있다 — DOM 없이 달린 속성을 볼 다른 길이 없다
  return (set?.find() ?? []).map(
    (decoration) => (decoration as unknown as { type: { attrs: unknown } }).type.attrs,
  );
}

describe("editor-block-resize: 끄는 동안 폭을 미리 보인다", () => {
  it("WHEN 그림 블록에 previewBlockWidth(pos, 40) THEN 그 블록 장식의 style에 --w:40이 있고 문서는 그대로다", () => {
    const initial = start();

    const { ok, state } = run(initial, previewBlockWidth(IMAGE, 40));

    expect(ok).toBe(true);
    expect(state.doc.eq(initial.doc)).toBe(true);
    expect(previewAttrs(state)).toEqual([{ style: "--w:40" }]);
  });

  it("WHEN 미리보기 중에 글자를 입력한다, 또는 문단에 previewBlockWidth THEN 앞은 장식이 사라지고, 뒤는 false다", () => {
    const previewing = run(start(), previewBlockWidth(IMAGE, 40)).state;

    const typed = previewing.apply(previewing.tr.insertText("나", 1));
    expect(previewAttrs(typed)).toEqual([]);

    const onParagraph = run(start(), previewBlockWidth(0, 40));
    expect(onParagraph.ok).toBe(false);
    const outOfRange = run(start(), previewBlockWidth(IMAGE, 101));
    expect(outOfRange.ok).toBe(false);
  });
});
